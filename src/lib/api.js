// Data/auth API. Uses Supabase when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set,
// otherwise falls back to the in-browser demo store (see demoStore.js).
import { createClient } from '@supabase/supabase-js';
import { demoApi } from './demoStore.js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const PROFILE_COLS = 'id,email,full_name,role_id,group_no,service_team,is_ministry_tl,is_committee,ig_handle,active,created_at';

function unwrap({ data, error }) {
  if (error) throw new Error(friendly(error.message));
  return data;
}
function friendly(msg) {
  if (/Invalid login credentials/i.test(msg)) return 'Email atau password salah.';
  if (/rate limit/i.test(msg)) return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.';
  return msg;
}

function supabaseApi() {
  const sb = createClient(URL, KEY, { auth: { persistSession: true } });
  const signed = new Map();
  // Account creation / password reset need the service role, so they go through the admin-users Edge Function.
  const adminUsers = async (body) => {
    const { data, error } = await sb.functions.invoke('admin-users', { body });
    if (error) {
      let msg = error.message;
      try { msg = (await error.context.json()).error || msg; } catch { /* non-JSON error */ }
      if (/Failed to send a request|FunctionsFetchError/i.test(msg)) msg = 'Edge Function "admin-users" belum di-deploy. Lihat README.';
      throw new Error(msg);
    }
    return data;
  };
  return {
    mode: 'supabase',
    async getSessionUserId() { return unwrap(await sb.auth.getSession()).session?.user.id ?? null; },
    onAuthChange(fn) {
      // Defer: calling other supabase methods inside this callback can deadlock the auth lock.
      const { data } = sb.auth.onAuthStateChange(() => setTimeout(fn, 0));
      return () => data.subscription.unsubscribe();
    },
    async signInPassword(email, password) { unwrap(await sb.auth.signInWithPassword({ email, password })); },
    async signOut() { unwrap(await sb.auth.signOut()); },
    async getProfile(id) { return unwrap(await sb.from('profiles').select(PROFILE_COLS).eq('id', id).maybeSingle()); },
    async listProfiles() { return unwrap(await sb.from('profiles').select(PROFILE_COLS).order('full_name')); },
    async updateProfile(id, patch) { return unwrap(await sb.from('profiles').update(patch).eq('id', id).select(PROFILE_COLS).single()); },
    // [[id, patch], …] — small batches so a 140-member reshuffle doesn't open 140 requests at once.
    async updateMany(list) {
      const out = [];
      for (let i = 0; i < list.length; i += 10) {
        out.push(...(await Promise.all(list.slice(i, i + 10).map(([id, patch]) => this.updateProfile(id, patch)))));
      }
      return out;
    },
    async createMember(fields) { return (await adminUsers({ action: 'create', ...fields })).profile; },
    async setPassword(id, password) { await adminUsers({ action: 'set_password', id, password }); },
    async getGrants() {
      const rows = unwrap(await sb.from('role_permissions').select('role_id,permission_id'));
      return rows.reduce((acc, r) => ((acc[r.role_id] ||= []).push(r.permission_id), acc), {});
    },
    async setGrant(role, perm, on) {
      if (on) unwrap(await sb.from('role_permissions').insert({ role_id: role, permission_id: perm }));
      else unwrap(await sb.from('role_permissions').delete().eq('role_id', role).eq('permission_id', perm));
    },

    // ── Game data ──
    async listGroups() { return unwrap(await sb.from('groups').select('*').order('sort').order('no')); },
    async createGroup(g) { return unwrap(await sb.from('groups').insert(g).select('*').single()); },
    // Renumbering (patch.no) cascades to members, draws, submissions and notifications in the DB.
    async updateGroup(no, patch) { return unwrap(await sb.from('groups').update(patch).eq('no', no).select('*').single()); },
    async deleteGroup(no) { unwrap(await sb.from('groups').delete().eq('no', no)); },
    async setGroupsLocked(locked) {
      unwrap(await sb.from('groups').update(locked ? { locked_at: new Date().toISOString(), locked_by: (await this.getSessionUserId()) } : { locked_at: null, locked_by: null }).neq('no', ''));
    },
    async listChallenges() { return unwrap(await sb.from('challenges').select('*').order('sort')); },
    async saveChallenge({ id, created_at, updated_at, ...c }) {
      const q = id ? sb.from('challenges').update(c).eq('id', id) : sb.from('challenges').insert(c);
      return unwrap(await q.select('*').single());
    },
    async deleteChallenge(id) { unwrap(await sb.from('challenges').delete().eq('id', id)); },
    // Riddles with answers; answers come back empty for members (RLS on riddle_answers).
    async listRiddles(challengeId) {
      const riddles = unwrap(await sb.from('riddles').select('id,challenge_id,no,prompt').eq('challenge_id', challengeId).order('no'));
      if (!riddles.length) return [];
      const answers = unwrap(await sb.from('riddle_answers').select('riddle_id,answer').in('riddle_id', riddles.map((r) => r.id)));
      const byId = Object.fromEntries(answers.map((a) => [a.riddle_id, a.answer]));
      return riddles.map((r) => ({ ...r, answer: byId[r.id] ?? null }));
    },
    async saveRiddle({ id, answer, ...r }) {
      const row = unwrap(await (id ? sb.from('riddles').update(r).eq('id', id) : sb.from('riddles').insert(r)).select('id,challenge_id,no,prompt').single());
      unwrap(await sb.from('riddle_answers').upsert({ riddle_id: row.id, answer: answer || '' }));
      return { ...row, answer };
    },
    async deleteRiddle(id) { unwrap(await sb.from('riddles').delete().eq('id', id)); },
    async getDraw(challengeId) { return unwrap(await sb.from('riddle_draws').select('group_no,slot,riddle_id').eq('challenge_id', challengeId)); },
    async saveDraw(challengeId, rows, seed) {
      unwrap(await sb.from('riddle_draws').delete().eq('challenge_id', challengeId));
      if (rows.length) unwrap(await sb.from('riddle_draws').insert(rows.map((r) => ({ ...r, challenge_id: challengeId }))));
      return this.saveChallenge({ id: challengeId, draw_seed: seed });
    },
    async listSubmissions({ challengeId, groupNo } = {}) {
      let q = sb.from('submissions').select('*').order('submitted_at');
      if (challengeId) q = q.eq('challenge_id', challengeId);
      if (groupNo) q = q.eq('group_no', groupNo);
      return unwrap(await q);
    },
    async createSubmission({ file, ...s }) {
      if (file) {
        const path = `${s.group_no}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
        unwrap(await sb.storage.from('submission-media').upload(path, file, { contentType: file.type }));
        s = { ...s, media_path: path, media_name: file.name };
      }
      return unwrap(await sb.from('submissions').insert(s).select('*').single());
    },
    async reviewSubmission(id, patch) { return unwrap(await sb.from('submissions').update(patch).eq('id', id).select('*').single()); },
    // Signed URLs last an hour; reuse them for 50 minutes.
    async mediaUrl(path) {
      if (!path) return null;
      const hit = signed.get(path);
      if (hit && hit.until > Date.now()) return hit.url;
      const url = unwrap(await sb.storage.from('submission-media').createSignedUrl(path, 3600)).signedUrl;
      signed.set(path, { url, until: Date.now() + 50 * 60e3 });
      return url;
    },
    async groupScores() { return unwrap(await sb.rpc('group_scores')); },

    // ── Notifications (created by DB triggers / pg_cron; RLS limits to everyone + my group) ──
    async listNotifications() {
      const rows = unwrap(await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(50));
      const reads = unwrap(await sb.from('notification_reads').select('notification_id'));
      const read = new Set(reads.map((r) => r.notification_id));
      return rows.map((n) => ({ ...n, read: read.has(n.id) }));
    },
    async markNotificationsRead(ids) {
      if (!ids.length) return;
      const uid = await this.getSessionUserId();
      unwrap(await sb.from('notification_reads').upsert(ids.map((id) => ({ user_id: uid, notification_id: id })), { onConflict: 'user_id,notification_id', ignoreDuplicates: true }));
    },
  };
}

export const api = URL && KEY ? supabaseApi() : demoApi;

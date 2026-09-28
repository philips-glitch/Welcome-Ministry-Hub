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
  };
}

export const api = URL && KEY ? supabaseApi() : demoApi;

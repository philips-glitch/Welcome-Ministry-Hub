// Data/auth API. Uses Supabase when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set,
// otherwise falls back to the in-browser demo store (see demoStore.js).
import { createClient } from '@supabase/supabase-js';
import { demoApi } from './demoStore.js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const PROFILE_COLS = 'id,email,full_name,role_id,group_no,service_team,is_ministry_tl,is_committee,ig_handle,active,created_at';
// Where magic links / OAuth return to. PKCE puts the code in ?code=, leaving our #/ routes alone.
const redirectTo = () => window.location.origin + window.location.pathname;

function unwrap({ data, error }) {
  if (error) throw new Error(friendly(error.message));
  return data;
}
function friendly(msg) {
  if (/Invalid login credentials/i.test(msg)) return 'Email atau password salah.';
  if (/Email not confirmed/i.test(msg)) return 'Email belum dikonfirmasi. Cek inbox kamu.';
  if (/Signups not allowed|not found|User not found/i.test(msg)) return 'Email ini belum diundang. Hubungi panitia.';
  if (/rate limit/i.test(msg)) return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.';
  return msg;
}

function supabaseApi() {
  const sb = createClient(URL, KEY, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } });
  return {
    mode: 'supabase',
    async getSessionUserId() { return unwrap(await sb.auth.getSession()).session?.user.id ?? null; },
    onAuthChange(fn) {
      // Defer: calling other supabase methods inside this callback can deadlock the auth lock.
      const { data } = sb.auth.onAuthStateChange(() => setTimeout(fn, 0));
      return () => data.subscription.unsubscribe();
    },
    async signInPassword(email, password) { unwrap(await sb.auth.signInWithPassword({ email, password })); },
    // Login only — members must be invited first, so no self-signup here.
    async signInMagicLink(email) { unwrap(await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo() } })); },
    async signInGoogle() { unwrap(await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } })); },
    async signOut() { unwrap(await sb.auth.signOut()); },
    async getProfile(id) { return unwrap(await sb.from('profiles').select(PROFILE_COLS).eq('id', id).maybeSingle()); },
    async listProfiles() { return unwrap(await sb.from('profiles').select(PROFILE_COLS).order('full_name')); },
    async updateProfile(id, patch) { return unwrap(await sb.from('profiles').update(patch).eq('id', id).select(PROFILE_COLS).single()); },
    // Sends a magic-link invite; the DB trigger creates the profile, then we fill in the admin's fields.
    async inviteMember({ email, ...fields }) {
      email = email.trim().toLowerCase();
      unwrap(await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: redirectTo(), data: { full_name: fields.full_name } } }));
      const row = unwrap(await sb.from('profiles').select('id').ilike('email', email).maybeSingle());
      if (!row) throw new Error('Undangan terkirim, tapi profil belum muncul. Muat ulang sebentar lagi.');
      return this.updateProfile(row.id, fields);
    },
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

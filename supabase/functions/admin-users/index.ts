// Supabase Edge Function: admin-only account operations that need the service role.
//   POST { action: 'create', username, password, full_name, contact_email?, role_id?, group_no?, service_team?, ig_handle?, is_ministry_tl?, is_committee? }
//   POST { action: 'set_password', id, password }
//   POST { action: 'set_username', id, username }
//   POST { action: 'reset_roster', groups: [{ no, name, color, min_size, max_size, sort }] }   (Super Admin only)
//        Roster import, step 1: deletes every account except Super Admins, all submissions (and their photos),
//        draws, notifications and Get to Know Me answers, then replaces the groups. The app then creates the
//        new accounts one by one with 'create'.
// Members log in with a username; Supabase Auth gets a hidden email "<username>@users.flourish.local".
// Caller must be signed in and hold `members.manage`; touching Super Admin also needs `roles.manage`.
// Deploy: supabase functions deploy admin-users
import { createClient } from 'npm:@supabase/supabase-js@2';

const AUTH_EMAIL_DOMAIN = 'users.flourish.local'; // keep in sync with src/lib/username.js
const USERNAME_RE = /^[a-z0-9][a-z0-9._]{2,23}$/;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const PROFILE_FIELDS = ['full_name', 'contact_email', 'role_id', 'group_no', 'service_team', 'position', 'ministry_role', 'ig_handle', 'is_ministry_tl', 'is_committee'] as const;
const PROFILE_COLS = 'id,email,username,contact_email,full_name,role_id,group_no,service_team,position,ministry_role,is_ministry_tl,is_committee,ig_handle,active,created_at';
const normUser = (u: unknown) => String(u ?? '').trim().toLowerCase().replace(/^@/, '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json(401, { error: 'Silakan masuk dulu.' });

  const can = async (perm: string) => (await caller.rpc('has_permission', { perm })).data === true;
  if (!(await can('members.manage'))) return json(403, { error: 'Tidak punya izin mengelola member.' });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: 'Body harus JSON.' }); }

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const password = String(body.password ?? '');
  const needsPassword = body.action === 'create' || body.action === 'set_password';
  if (needsPassword && password.length < 8) return json(400, { error: 'Password minimal 8 karakter.' });

  const usernameTaken = async (u: string, exceptId?: string) => {
    const { data } = await admin.from('profiles').select('id').eq('username', u).maybeSingle();
    return !!data && data.id !== exceptId;
  };
  const targetRole = async (id: string) => (await admin.from('profiles').select('role_id').eq('id', id).maybeSingle()).data?.role_id;

  if (body.action === 'create') {
    const username = normUser(body.username);
    if (!USERNAME_RE.test(username)) return json(400, { error: 'Username 3–24 karakter: huruf kecil, angka, titik, garis bawah.' });
    if (await usernameTaken(username)) return json(400, { error: `Username “${username}” sudah dipakai.` });
    if (body.role_id === 'super_admin' && !(await can('roles.manage'))) return json(403, { error: 'Tidak bisa membuat Super Admin.' });

    const { data, error } = await admin.auth.admin.createUser({
      email: `${username}@${AUTH_EMAIL_DOMAIN}`, password, email_confirm: true,
      user_metadata: { full_name: body.full_name ?? null, username },
    });
    if (error) return json(400, { error: /already been registered|already exists/i.test(error.message) ? `Username “${username}” sudah dipakai.` : error.message });

    // The on_auth_user_created trigger inserted the profile; fill in the admin's fields.
    const patch: Record<string, unknown> = { username };
    for (const k of PROFILE_FIELDS) if (body[k] !== undefined) patch[k] = body[k];
    const { data: profile, error: pErr } = await admin.from('profiles').update(patch).eq('id', data.user.id).select(PROFILE_COLS).single();
    if (pErr) return json(500, { error: 'Akun dibuat, tapi profil gagal disimpan: ' + pErr.message });
    return json(200, { profile });
  }

  if (body.action === 'set_password' || body.action === 'set_username') {
    const id = String(body.id ?? '');
    const role = await targetRole(id);
    if (!role) return json(404, { error: 'Member tidak ditemukan.' });
    if (role === 'super_admin' && id !== user.id && !(await can('roles.manage'))) {
      return json(403, { error: 'Tidak bisa mengubah akun Super Admin.' });
    }

    if (body.action === 'set_password') {
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return json(400, { error: error.message });
      return json(200, { ok: true });
    }

    const username = normUser(body.username);
    if (!USERNAME_RE.test(username)) return json(400, { error: 'Username 3–24 karakter: huruf kecil, angka, titik, garis bawah.' });
    if (await usernameTaken(username, id)) return json(400, { error: `Username “${username}” sudah dipakai.` });
    const email = `${username}@${AUTH_EMAIL_DOMAIN}`;
    const { error } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true, user_metadata: { username } });
    if (error) return json(400, { error: error.message });
    const { data: profile, error: pErr } = await admin.from('profiles').update({ username, email }).eq('id', id).select(PROFILE_COLS).single();
    if (pErr) return json(500, { error: 'Login diubah, tapi profil gagal disimpan: ' + pErr.message });
    return json(200, { profile });
  }

  if (body.action === 'reset_roster') {
    if (!(await can('roles.manage'))) return json(403, { error: 'Hanya Super Admin yang bisa import roster.' });
    const groups = Array.isArray(body.groups) ? body.groups as Record<string, unknown>[] : [];
    if (!groups.length || groups.some((g) => !/^[0-9]{2,3}$/.test(String(g.no)) || !String(g.name ?? '').trim())) {
      return json(400, { error: 'Daftar grup tidak valid.' });
    }
    const fail = (step: string, e: { message: string } | null) => (e ? json(500, { error: `Reset gagal (${step}): ${e.message}` }) : null);

    // Game data tied to the old roster. Photos first, while their paths are still known.
    const bucket = admin.storage.from('submission-media');
    const { data: dirs } = await bucket.list('', { limit: 1000 });
    for (const d of dirs ?? []) {
      const { data: files } = await bucket.list(d.name, { limit: 1000 });
      if (files?.length) await bucket.remove(files.map((x) => `${d.name}/${x.name}`));
    }
    let r = fail('submissions', (await admin.from('submissions').delete().not('id', 'is', null)).error)
      ?? fail('notifications', (await admin.from('notifications').delete().not('id', 'is', null)).error)
      ?? fail('draws', (await admin.from('riddle_draws').delete().not('challenge_id', 'is', null)).error)
      ?? fail('Get to Know Me', (await admin.from('profile_gtkm').delete().not('profile_id', 'is', null)).error)
      ?? fail('challenges', (await admin.from('challenges').update({ draw_seed: null, draw_locked: false }).not('id', 'is', null)).error)
      ?? fail('super admin', (await admin.from('profiles').update({ group_no: null }).eq('role_id', 'super_admin')).error);
    if (r) return r;

    // Every account except Super Admins (profiles go with them: on delete cascade).
    const { data: old, error: oErr } = await admin.from('profiles').select('id').neq('role_id', 'super_admin');
    if ((r = fail('accounts', oErr))) return r;
    let removed = 0;
    for (const { id } of old ?? []) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json(500, { error: `Reset berhenti setelah ${removed} akun dihapus: ${error.message}` });
      removed++;
    }

    // Groups: drop the ones not in the file, then insert/rename the rest.
    const nos = groups.map((g) => String(g.no));
    r = fail('groups', (await admin.from('groups').delete().not('no', 'in', `(${nos.join(',')})`)).error)
      ?? fail('groups', (await admin.from('groups').upsert(groups.map((g, i) => ({
        no: String(g.no), name: String(g.name).trim(), color: String(g.color ?? '#1F4D3A'),
        min_size: Number(g.min_size) || 0, max_size: Math.max(Number(g.max_size) || 0, Number(g.min_size) || 0),
        sort: Number(g.sort) || i + 1, locked_at: null, locked_by: null,
      })), { onConflict: 'no' })).error);
    if (r) return r;
    return json(200, { removed });
  }

  return json(400, { error: 'Action tidak dikenal.' });
});

// Supabase Edge Function: admin-only account operations that need the service role.
//   POST { action: 'create', email, password, full_name, role_id?, group_no?, service_team?, ig_handle?, is_ministry_tl?, is_committee? }
//   POST { action: 'set_password', id, password }
// Caller must be signed in and hold `members.manage`; touching Super Admin also needs `roles.manage`.
// Deploy: supabase functions deploy admin-users
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const PROFILE_FIELDS = ['full_name', 'role_id', 'group_no', 'service_team', 'ig_handle', 'is_ministry_tl', 'is_committee'] as const;
const PROFILE_COLS = 'id,email,full_name,role_id,group_no,service_team,is_ministry_tl,is_committee,ig_handle,active,created_at';

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
  if (password.length < 8) return json(400, { error: 'Password minimal 8 karakter.' });

  if (body.action === 'create') {
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return json(400, { error: 'Email tidak valid.' });
    if (body.role_id === 'super_admin' && !(await can('roles.manage'))) return json(403, { error: 'Tidak bisa membuat Super Admin.' });

    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: body.full_name ?? null },
    });
    if (error) return json(400, { error: /already been registered|already exists/i.test(error.message) ? 'Email sudah terdaftar.' : error.message });

    // The on_auth_user_created trigger inserted the profile; fill in the admin's fields.
    const patch: Record<string, unknown> = {};
    for (const k of PROFILE_FIELDS) if (body[k] !== undefined) patch[k] = body[k];
    const { data: profile, error: pErr } = await admin.from('profiles').update(patch).eq('id', data.user.id).select(PROFILE_COLS).single();
    if (pErr) return json(500, { error: 'Akun dibuat, tapi profil gagal disimpan: ' + pErr.message });
    return json(200, { profile });
  }

  if (body.action === 'set_password') {
    const id = String(body.id ?? '');
    const { data: target } = await admin.from('profiles').select('role_id').eq('id', id).maybeSingle();
    if (!target) return json(404, { error: 'Member tidak ditemukan.' });
    if (target.role_id === 'super_admin' && id !== user.id && !(await can('roles.manage'))) {
      return json(403, { error: 'Tidak bisa mengganti password Super Admin.' });
    }
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) return json(400, { error: error.message });
    return json(200, { ok: true });
  }

  return json(400, { error: 'Action tidak dikenal.' });
});

-- Flourish Hub · auth, member profiles and role-based access control.
-- Run once in the Supabase SQL editor (or `supabase db push`).

-- ───────────────────────── Tables ─────────────────────────
create table public.roles (
  id          text primary key,
  name        text not null,
  description text,
  sort        int  not null default 0
);

create table public.permissions (
  id       text primary key,
  label    text not null,
  category text not null,
  sort     int  not null default 0
);

create table public.role_permissions (
  role_id       text not null references public.roles on delete cascade,
  permission_id text not null references public.permissions on delete cascade,
  primary key (role_id, permission_id)
);

create table public.profiles (
  id             uuid primary key references auth.users on delete cascade,
  email          text not null,
  full_name      text,
  role_id        text not null default 'member' references public.roles,
  group_no       text check (group_no ~ '^(0[1-9]|10)$'),
  service_team   text,
  is_ministry_tl boolean not null default false,
  is_committee   boolean not null default false,  -- panitia: excluded from group forming
  ig_handle      text,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));

-- ───────────────────────── Helpers ─────────────────────────
-- True when the signed-in, active user's role grants `perm`.
create or replace function public.has_permission(perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    join role_permissions rp on rp.role_id = p.role_id
    where p.id = auth.uid() and p.active and rp.permission_id = perm
  );
$$;

-- Every new auth user gets a profile with the lowest role. Role is never read
-- from user metadata (that is user-controlled).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Column-level guard: members may edit their own name / IG handle only.
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then  -- SQL editor / service role
    new.updated_at := now();
    return new;
  end if;
  if new.id <> old.id or new.email <> old.email then
    raise exception 'ID dan email tidak bisa diubah';
  end if;
  if (new.role_id, new.group_no, new.service_team, new.is_ministry_tl, new.is_committee, new.active)
     is distinct from (old.role_id, old.group_no, old.service_team, old.is_ministry_tl, old.is_committee, old.active)
     and not has_permission('members.manage') then
    raise exception 'Tidak punya izin mengubah data keanggotaan';
  end if;
  if new.role_id is distinct from old.role_id and old.id = auth.uid() then
    raise exception 'Tidak bisa mengubah role sendiri';
  end if;
  if new.role_id is distinct from old.role_id and 'super_admin' in (new.role_id, old.role_id)
     and not has_permission('roles.manage') then
    raise exception 'Hanya pemegang hak "roles.manage" yang bisa memberi / mencabut Super Admin';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_guard
  before update on public.profiles for each row execute function public.guard_profile_update();

-- ───────────────────────── RLS ─────────────────────────
alter table public.profiles         enable row level security;
alter table public.roles            enable row level security;
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;

create policy "profiles: read own or with members.view" on public.profiles
  for select to authenticated using (id = auth.uid() or public.has_permission('members.view'));
create policy "profiles: update own or with members.manage" on public.profiles
  for update to authenticated using (id = auth.uid() or public.has_permission('members.manage'));

create policy "roles: read" on public.roles for select to authenticated using (true);
create policy "permissions: read" on public.permissions for select to authenticated using (true);
create policy "role_permissions: read" on public.role_permissions for select to authenticated using (true);
-- Super Admin grants are fixed so the event can't be locked out.
create policy "role_permissions: grant" on public.role_permissions
  for insert to authenticated with check (public.has_permission('roles.manage') and role_id <> 'super_admin');
create policy "role_permissions: revoke" on public.role_permissions
  for delete to authenticated using (public.has_permission('roles.manage') and role_id <> 'super_admin');

-- ───────────────────────── Seed ─────────────────────────
insert into public.roles (id, name, description, sort) values
  ('super_admin',   'Super Admin',   'Tim Acara. Akses penuh, termasuk hak akses.', 1),
  ('challenge_pic', 'Challenge PIC', 'Penanggung jawab satu challenge.',            2),
  ('captain',       'Captain',       'Pendamping grup, validasi submission.',       3),
  ('group_leader',  'Group Leader',  'Satu per grup. Bisa submit.',                 4),
  ('member',        'Member',        'Peserta. Lihat challenge & leaderboard.',     5);

insert into public.permissions (id, label, category, sort) values
  ('dashboard.view',       'Buka Admin Dashboard',              'Admin',  1),
  ('groups.manage',        'Bentuk & kunci grup',               'Admin',  2),
  ('challenges.manage',    'Kelola challenge & riddle',         'Admin',  3),
  ('submissions.validate', 'Validasi submission',               'Admin',  4),
  ('scores.view',          'Lihat Scoring & Leaderboard',       'Admin',  5),
  ('members.view',         'Lihat daftar member',               'Member', 6),
  ('members.manage',       'Undang, ubah & nonaktifkan member', 'Member', 7),
  ('roles.manage',         'Ubah role & hak akses',             'Member', 8),
  ('portal.view',          'Buka Game Portal',                  'Portal', 9),
  ('portal.submit',        'Submit challenge untuk grup',       'Portal', 10);

insert into public.role_permissions (role_id, permission_id)
select 'super_admin', id from public.permissions;
insert into public.role_permissions (role_id, permission_id) values
  ('challenge_pic', 'dashboard.view'), ('challenge_pic', 'challenges.manage'), ('challenge_pic', 'submissions.validate'),
  ('challenge_pic', 'scores.view'), ('challenge_pic', 'members.view'), ('challenge_pic', 'portal.view'),
  ('captain', 'dashboard.view'), ('captain', 'submissions.validate'), ('captain', 'scores.view'),
  ('captain', 'members.view'), ('captain', 'portal.view'),
  ('group_leader', 'portal.view'), ('group_leader', 'portal.submit'),
  ('member', 'portal.view');

-- ───────────────────────── First admin ─────────────────────────
-- After you sign in once, promote yourself (run in the SQL editor):
--   update public.profiles set role_id = 'super_admin' where email = 'you@example.com';

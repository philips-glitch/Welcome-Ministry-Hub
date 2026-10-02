-- Flourish Hub · log in with a username instead of an email. Run after 0004_groups_crud.sql.
-- Accounts keep a hidden auth email "<username>@users.flourish.local" (set by the admin-users
-- Edge Function); profiles.email mirrors it. A real email is optional contact info.

alter table public.profiles
  add column if not exists username      text,
  add column if not exists contact_email text;

-- Backfill: username from the email's local part, de-duplicated with a number suffix.
with base as (
  select id, regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._]', '', 'g') as u,
         row_number() over (partition by regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._]', '', 'g') order by created_at) as n
  from public.profiles where username is null
)
update public.profiles p
set username = case
      when (case when b.n = 1 then b.u else b.u || b.n end) ~ '^[a-z0-9][a-z0-9._]{2,23}$'
        then case when b.n = 1 then b.u else b.u || b.n end
      else 'user' || substr(replace(p.id::text, '-', ''), 1, 8)  -- too short / odd local part
    end,
    contact_email = case when p.email not like '%@users.flourish.local' then p.email else p.contact_email end
from base b where b.id = p.id;

alter table public.profiles alter column username set not null;
alter table public.profiles add constraint profiles_username_format check (username ~ '^[a-z0-9][a-z0-9._]{2,23}$');
create unique index profiles_username_key on public.profiles (username);

-- New auth users: take the username from signup metadata (set by the Edge Function), else the email.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, username)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))));
  return new;
end $$;

-- Same guard as 0001, plus: username changes go through the Edge Function (service role) only,
-- because the hidden auth email must change with it.
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then  -- SQL editor / service role (Edge Function)
    new.updated_at := now();
    return new;
  end if;
  if new.id <> old.id or new.email <> old.email then
    raise exception 'ID dan email login tidak bisa diubah';
  end if;
  if new.username is distinct from old.username then
    raise exception 'Username diubah lewat menu Edit member (admin)';
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

-- Flourish Hub · fields from the ministry roster (Members → Import Excel). Run after 0006_playbook_events.sql.
--   position:      service position, e.g. "Usher", "Traffic & Controller", "Medical Team"
--   ministry_role: status in the ministry, e.g. "Volunteer", "Team Leader", "Trainee", "Volunteer (Inactive)"
-- service_team now holds the original team (its team leader's name) from the roster.

alter table public.profiles
  add column if not exists position      text,
  add column if not exists ministry_role text;

-- Same guard as 0005, with the two new fields protected like the other membership data.
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
  if (new.role_id, new.group_no, new.service_team, new.position, new.ministry_role, new.is_ministry_tl, new.is_committee, new.active)
     is distinct from (old.role_id, old.group_no, old.service_team, old.position, old.ministry_role, old.is_ministry_tl, old.is_committee, old.active)
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

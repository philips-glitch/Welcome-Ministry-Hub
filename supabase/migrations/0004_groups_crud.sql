-- Flourish Hub · groups become editable (create / rename / renumber / recolour / size limits / delete).
-- Run after 0003_notifications.sql.

-- Group numbers are no longer limited to 01–10: any 1–3 digit code, zero-padded by the app.
alter table public.groups drop constraint if exists groups_no_check;
alter table public.groups add constraint groups_no_check check (no ~ '^[0-9]{2,3}$');
alter table public.groups
  add column if not exists min_size   int not null default 13 check (min_size >= 0),
  add column if not exists max_size   int not null default 14,
  add column if not exists sort       int not null default 0,
  add column if not exists created_at timestamptz not null default now();
alter table public.groups add constraint groups_size_check check (max_size >= min_size);
update public.groups set sort = no::int where sort = 0;

-- profiles.group_no now points at a real group: renumbering follows, deleting un-assigns.
alter table public.profiles drop constraint if exists profiles_group_no_check;
alter table public.profiles add constraint profiles_group_no_fkey
  foreign key (group_no) references public.groups (no) on update cascade on delete set null;

-- Renumbering a group carries its draws, submissions and notifications with it.
-- Draws and notifications go with a deleted group; submissions block the delete (history).
alter table public.riddle_draws drop constraint if exists riddle_draws_group_no_fkey;
alter table public.riddle_draws add constraint riddle_draws_group_no_fkey
  foreign key (group_no) references public.groups (no) on update cascade on delete cascade;
alter table public.notifications drop constraint if exists notifications_group_no_fkey;
alter table public.notifications add constraint notifications_group_no_fkey
  foreign key (group_no) references public.groups (no) on update cascade on delete cascade;
alter table public.submissions drop constraint if exists submissions_group_no_fkey;
alter table public.submissions add constraint submissions_group_no_fkey
  foreign key (group_no) references public.groups (no) on update cascade on delete restrict;

-- Friendly error instead of a raw FK violation.
create or replace function public.guard_group_delete()
returns trigger language plpgsql as $$
declare n int;
begin
  select count(*) into n from submissions where group_no = old.no;
  if n > 0 then
    raise exception 'Grup % punya % submission dan tidak bisa dihapus. Ganti nama grup kalau perlu.', old.no, n;
  end if;
  return old;
end $$;
create trigger groups_guard_delete before delete on public.groups for each row execute function public.guard_group_delete();

create policy "groups: create" on public.groups for insert to authenticated with check (public.has_permission('groups.manage'));
create policy "groups: delete" on public.groups for delete to authenticated using (public.has_permission('groups.manage'));
-- ("groups: lock" from 0002 already allows updates with groups.manage.)

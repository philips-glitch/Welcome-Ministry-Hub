-- Flourish Hub · in-app notifications. Run after 0002_game.sql.
-- A notification targets everyone (group_no is null) or one group. Read state is per user.
-- All notifications are created by the database itself (triggers + a pg_cron job), never by clients.

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('review', 'challenge', 'reminder')),
  title        text not null,
  body         text,
  challenge_id uuid references public.challenges on delete cascade,
  group_no     text references public.groups,          -- null = everyone
  tone         text not null default 'info' check (tone in ('info', 'good', 'bad', 'warn')),
  dedupe_key   text unique,                             -- stops the same event notifying twice
  created_at   timestamptz not null default now()
);
create index notifications_audience_idx on public.notifications (group_no, created_at desc);

create table public.notification_reads (
  user_id         uuid not null references public.profiles on delete cascade,
  notification_id uuid not null references public.notifications on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (user_id, notification_id)
);

alter table public.notifications      enable row level security;
alter table public.notification_reads enable row level security;

create policy "notifications: my audience" on public.notifications for select to authenticated
  using (group_no is null or group_no = public.my_group());
create policy "reads: own" on public.notification_reads for select to authenticated using (user_id = auth.uid());
create policy "reads: mark own" on public.notification_reads for insert to authenticated with check (user_id = auth.uid());

-- Insert helper: silently skips duplicates.
create or replace function public.notify(p_kind text, p_title text, p_body text, p_challenge uuid, p_group text, p_tone text, p_key text)
returns void language sql security definer set search_path = public as $$
  insert into notifications (kind, title, body, challenge_id, group_no, tone, dedupe_key)
  values (p_kind, p_title, p_body, p_challenge, p_group, p_tone, p_key)
  on conflict (dedupe_key) do nothing;
$$;
revoke execute on function public.notify(text, text, text, uuid, text, text, text) from public, anon, authenticated;

-- 1 · Submission reviewed → the submitting group.
create or replace function public.notify_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare c challenges; r_no int; label text;
begin
  if new.status = old.status or new.status = 'submitted' then return new; end if;
  select * into c from challenges where id = new.challenge_id;
  select no into r_no from riddles where id = new.riddle_id;
  label := c.code || ' · ' || c.name || coalesce(' · Riddle ' || r_no, '');
  if new.status = 'validated' then
    perform notify('review', 'Submission disetujui 🎉', label || ' tervalidasi: +' || coalesce(new.score::text, '0') || ' poin.', c.id, new.group_no, 'good', 'review:' || new.id || ':validated');
  elsif new.status = 'rejected' then
    perform notify('review', 'Submission ditolak', label || ': ' || coalesce(new.reject_reason, 'lihat detail') || '. Kirim ulang sebelum deadline.', c.id, new.group_no, 'bad', 'review:' || new.id || ':rejected');
  elsif new.status = 'resubmit' then
    perform notify('review', 'Diminta kirim ulang', label || ': ' || coalesce(new.reject_reason, 'lihat detail') || '.', c.id, new.group_no, 'warn', 'review:' || new.id || ':resubmit');
  end if;
  return new;
end $$;
create trigger submissions_notify after update on public.submissions for each row execute function public.notify_review();

-- 2 · Challenge announced (Scheduled) or opened (Live) → everyone.
create or replace function public.notify_challenge()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status = old.status then return new; end if;
  if new.status = 'scheduled' then
    perform notify('challenge', 'Challenge baru: ' || new.name,
      new.code || coalesce(' dibuka ' || to_char(new.open_at at time zone 'Asia/Jakarta', 'DD Mon HH24:MI') || ' WIB', ' segera dibuka') || '.',
      new.id, null, 'info', 'challenge:' || new.id || ':scheduled');
  elsif new.status = 'live' then
    perform notify('challenge', new.name || ' sudah dibuka!',
      new.code || ' live' || coalesce(' s/d ' || to_char(new.deadline_at at time zone 'Asia/Jakarta', 'DD Mon HH24:MI') || ' WIB', '') || '. Yuk mulai!',
      new.id, null, 'good', 'challenge:' || new.id || ':live');
  end if;
  return new;
end $$;
create trigger challenges_notify after insert or update of status on public.challenges for each row execute function public.notify_challenge();

-- 3 · Deadline reminders, 24 h and 3 h before, to groups that still have something left to send
--     (riddles without a submitted/validated version, or no submission at all for non-riddle challenges).
create or replace function public.send_deadline_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare c record; g record; w record; left_n int; sent int := 0;
begin
  for c in select * from challenges where status = 'live' and deadline_at > now() and deadline_at <= now() + interval '24 hours' loop
    -- Only the reminder for the window we're in: "24" between 24 h and 3 h out, "3" in the last 3 h.
    for w in select * from (values ('24'), ('3')) v(label)
             where (v.label = '3') = (c.deadline_at <= now() + interval '3 hours') loop
      for g in select no from groups loop
        if c.riddles_per_group > 0 then
          select count(*) into left_n from riddle_draws d
          where d.challenge_id = c.id and d.group_no = g.no
            and not exists (select 1 from submissions s where s.challenge_id = c.id and s.group_no = g.no
                            and s.riddle_id = d.riddle_id and s.status in ('submitted', 'validated'));
        else
          select case when exists (select 1 from submissions s where s.challenge_id = c.id and s.group_no = g.no
                                   and s.status in ('submitted', 'validated')) then 0 else 1 end into left_n;
        end if;
        if left_n > 0 then
          perform notify('reminder', 'Deadline ' || w.label || ' jam lagi ⏰',
            c.name || ': ' || case when c.riddles_per_group > 0 then left_n || ' riddle belum dikirim' else 'grup kamu belum submit' end
              || '. Tutup ' || to_char(c.deadline_at at time zone 'Asia/Jakarta', 'DD Mon HH24:MI') || ' WIB.',
            c.id, g.no, 'warn', 'reminder' || w.label || ':' || c.id || ':' || g.no);
          sent := sent + 1;
        end if;
      end loop;
    end loop;
  end loop;
  return sent;
end $$;

-- Run the reminder check every 10 minutes (pg_cron ships with Supabase; enable it under Database → Extensions if needed).
create extension if not exists pg_cron;
select cron.schedule('flourish-deadline-reminders', '*/10 * * * *', $$select public.send_deadline_reminders()$$);

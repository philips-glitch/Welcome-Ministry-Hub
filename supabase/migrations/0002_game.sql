-- Flourish Hub · game data: groups, challenges, riddles, draws, submissions, scores.
-- Run after 0001_auth_roles.sql.

-- ───────────────────────── Tables ─────────────────────────
create table public.groups (
  no         text primary key check (no ~ '^(0[1-9]|10)$'),
  name       text not null,
  color      text not null,
  locked_at  timestamptz,           -- Lock & Publish
  locked_by  uuid references public.profiles on delete set null
);

create table public.challenges (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,                      -- 'R1', 'SQ1', …
  kind              text not null default 'main' check (kind in ('main', 'side')),
  round             int,
  name              text not null,
  pic_id            uuid references public.profiles on delete set null,
  status            text not null default 'draft'
                    check (status in ('draft', 'scheduled', 'live', 'closed', 'published')),
  announce_at       timestamptz,
  open_at           timestamptz,
  deadline_at       timestamptz,
  validate_by       timestamptz,
  sections          jsonb not null default '{}'::jsonb,        -- Game Idea, How to Play, …
  scoring           jsonb not null default '{"type":"riddle","max":10,"location_weight":50,"participation_weight":50,"tiers":[{"min":10,"pts":10},{"min":7,"pts":6},{"min":0,"pts":2}]}'::jsonb,
  riddles_per_group int not null default 0 check (riddles_per_group between 0 and 10),
  draw_seed         int,
  draw_locked       boolean not null default false,
  sort              int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.riddles (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges on delete cascade,
  no           int  not null,
  prompt       text not null,
  unique (challenge_id, no)
);
-- Answers live apart from prompts so members can read riddles without ever receiving answers.
create table public.riddle_answers (
  riddle_id uuid primary key references public.riddles on delete cascade,
  answer    text not null
);

create table public.riddle_draws (
  challenge_id uuid not null references public.challenges on delete cascade,
  group_no     text not null references public.groups,
  slot         int  not null,
  riddle_id    uuid not null references public.riddles on delete cascade,
  primary key (challenge_id, group_no, slot)
);

create table public.submissions (
  id                uuid primary key default gen_random_uuid(),
  challenge_id      uuid not null references public.challenges on delete cascade,
  group_no          text not null references public.groups,
  riddle_id         uuid references public.riddles on delete set null,
  version           int  not null default 1,
  status            text not null default 'submitted'
                    check (status in ('submitted', 'validated', 'rejected', 'resubmit')),
  submitted_by      uuid references public.profiles on delete set null default auth.uid(),
  submitted_at      timestamptz not null default now(),
  media_path        text,           -- storage object in bucket "submission-media"
  media_name        text,
  ig_url            text,
  tagged_ids        uuid[] not null default '{}',
  declaration       boolean not null default false,
  -- review
  reviewed_by       uuid references public.profiles on delete set null,
  reviewed_at       timestamptz,
  checks            jsonb,
  location_correct  boolean,
  participant_count int,
  score             numeric(6,2),
  override_note     text,
  reject_reason     text
);
create index submissions_challenge_idx on public.submissions (challenge_id, status);
create index submissions_group_idx on public.submissions (group_no);

-- ───────────────────────── Helpers ─────────────────────────
create or replace function public.my_group()
returns text language sql stable security definer set search_path = public as $$
  select group_no from profiles where id = auth.uid() and active;
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger challenges_touch before update on public.challenges for each row execute function public.touch_updated_at();

-- Members submit only for their own group, only while the challenge is live and before the deadline,
-- and can't set review fields. Versions count up per (challenge, group, riddle).
create or replace function public.prepare_submission()
returns trigger language plpgsql security definer set search_path = public as $$
declare c challenges;
begin
  select * into c from challenges where id = new.challenge_id;
  if c.status <> 'live' or (c.deadline_at is not null and now() > c.deadline_at) then
    raise exception 'Challenge ini sedang tidak menerima submission';
  end if;
  if auth.uid() is not null and new.group_no is distinct from my_group() then
    raise exception 'Hanya bisa submit untuk grup sendiri';
  end if;
  new.status := 'submitted';
  new.submitted_by := coalesce(auth.uid(), new.submitted_by);
  new.submitted_at := now();
  new.reviewed_by := null; new.reviewed_at := null; new.score := null; new.checks := null;
  new.location_correct := null; new.participant_count := null; new.override_note := null; new.reject_reason := null;
  new.version := coalesce((select max(version) from submissions
                           where challenge_id = new.challenge_id and group_no = new.group_no
                             and riddle_id is not distinct from new.riddle_id), 0) + 1;
  return new;
end $$;
create trigger submissions_prepare before insert on public.submissions for each row execute function public.prepare_submission();

-- Reviews stamp who/when; submission content stays as submitted.
create or replace function public.guard_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.challenge_id := old.challenge_id; new.group_no := old.group_no; new.riddle_id := old.riddle_id;
    new.version := old.version; new.submitted_by := old.submitted_by; new.submitted_at := old.submitted_at;
    new.media_path := old.media_path; new.media_name := old.media_name; new.ig_url := old.ig_url;
    new.tagged_ids := old.tagged_ids; new.declaration := old.declaration;
    new.reviewed_by := auth.uid();
  end if;
  new.reviewed_at := now();
  return new;
end $$;
create trigger submissions_review before update on public.submissions for each row execute function public.guard_review();

-- Leaderboard: validated points per group per challenge. Security definer so every member sees
-- all groups' totals without being able to read other groups' submissions.
create or replace function public.group_scores()
returns table (group_no text, challenge_id uuid, points numeric, validated int)
language sql stable security definer set search_path = public as $$
  select s.group_no, s.challenge_id, coalesce(sum(s.score), 0), count(*)::int
  from submissions s join challenges c on c.id = s.challenge_id
  where s.status = 'validated' and c.status <> 'draft'
  group by s.group_no, s.challenge_id;
$$;

-- ───────────────────────── RLS ─────────────────────────
alter table public.groups         enable row level security;
alter table public.challenges     enable row level security;
alter table public.riddles        enable row level security;
alter table public.riddle_answers enable row level security;
alter table public.riddle_draws   enable row level security;
alter table public.submissions    enable row level security;

-- Group-mates can see each other (roster for tagging in the portal).
create policy "profiles: read own group" on public.profiles
  for select to authenticated using (group_no is not null and group_no = public.my_group());

create policy "groups: read" on public.groups for select to authenticated using (true);
create policy "groups: lock" on public.groups for update to authenticated using (public.has_permission('groups.manage'));

create policy "challenges: read" on public.challenges for select to authenticated
  using (status <> 'draft' or public.has_permission('challenges.manage'));
create policy "challenges: insert" on public.challenges for insert to authenticated with check (public.has_permission('challenges.manage'));
create policy "challenges: update" on public.challenges for update to authenticated using (public.has_permission('challenges.manage'));
create policy "challenges: delete" on public.challenges for delete to authenticated using (public.has_permission('challenges.manage'));

-- Staff see every riddle; members only the ones drawn for their group once the challenge is live.
create policy "riddles: read" on public.riddles for select to authenticated using (
  public.has_permission('challenges.manage') or public.has_permission('submissions.validate')
  or exists (select 1 from riddle_draws d join challenges c on c.id = d.challenge_id
             where d.riddle_id = riddles.id and d.group_no = public.my_group()
               and c.status in ('live', 'closed', 'published')));
create policy "riddles: write" on public.riddles for all to authenticated
  using (public.has_permission('challenges.manage')) with check (public.has_permission('challenges.manage'));

create policy "riddle_answers: staff" on public.riddle_answers for select to authenticated
  using (public.has_permission('challenges.manage') or public.has_permission('submissions.validate'));
create policy "riddle_answers: write" on public.riddle_answers for all to authenticated
  using (public.has_permission('challenges.manage')) with check (public.has_permission('challenges.manage'));

create policy "riddle_draws: read" on public.riddle_draws for select to authenticated using (
  public.has_permission('challenges.manage') or public.has_permission('submissions.validate')
  or (group_no = public.my_group() and exists (select 1 from challenges c where c.id = challenge_id and c.status in ('live', 'closed', 'published'))));
create policy "riddle_draws: write" on public.riddle_draws for all to authenticated
  using (public.has_permission('challenges.manage')) with check (public.has_permission('challenges.manage'));

create policy "submissions: read" on public.submissions for select to authenticated using (
  group_no = public.my_group() or public.has_permission('submissions.validate') or public.has_permission('scores.view'));
create policy "submissions: submit" on public.submissions for insert to authenticated
  with check (public.has_permission('portal.submit'));
create policy "submissions: review" on public.submissions for update to authenticated
  using (public.has_permission('submissions.validate'));

-- ───────────────────────── Storage ─────────────────────────
-- Photos: submission-media/<group_no>/<file>. Group-mates and validators can read.
insert into storage.buckets (id, name, public) values ('submission-media', 'submission-media', false)
  on conflict (id) do nothing;
create policy "media: upload own group" on storage.objects for insert to authenticated
  with check (bucket_id = 'submission-media' and (storage.foldername(name))[1] = public.my_group());
create policy "media: read" on storage.objects for select to authenticated
  using (bucket_id = 'submission-media' and ((storage.foldername(name))[1] = public.my_group()
         or public.has_permission('submissions.validate')));

-- ───────────────────────── Seed ─────────────────────────
insert into public.groups (no, name, color) values
  ('01', 'Olive', '#7F8F24'), ('02', 'Cedar', '#2A8C82'), ('03', 'Fig', '#C4533F'), ('04', 'Vine', '#8A4FA3'),
  ('05', 'Mustard Seed', '#C98A12'), ('06', 'Lily', '#D0577E'), ('07', 'Palm', '#3E86C9'), ('08', 'Oak', '#9A6435'),
  ('09', 'Willow', '#4E9A55'), ('10', 'Hyssop', '#5C63B8');

-- Challenges from the WM 2026 plan (times in WIB = UTC+7). PICs are set later in the app.
insert into public.challenges (code, kind, round, name, status, announce_at, open_at, deadline_at, validate_by, riddles_per_group, sort, sections, scoring) values
  ('R1', 'main', 1, 'Photo Challenge', 'scheduled', '2026-10-15 20:00+07', '2026-10-15 20:00+07', '2026-10-18 23:55+07', '2026-10-20 23:59+07', 4, 1,
   '{"game_idea":"Riddle berburu lokasi di area gereja. Tiap grup dapat 4 riddle acak dari bank 10.","how_to_play":"Pecahkan riddle → datang ke lokasi → selfie satu grup → post IG Story tag akun event → Leader submit di portal.","connection":"Memaksa grup bergerak bareng dan ngobrol di luar jam pelayanan biasa.","points_rewards":"Maks 10/riddle: 50% lokasi benar + 50% partisipasi. “First correct” direpost Rabu.","flourish_hub":"Submit: foto grup + link/screenshot IG Story + tag anggota + deklarasi No-AI. Verifikasi oleh captain.","what_we_need":"Venue: seluruh area gedung · Material: riddle card digital.","make_it_flourish":"Repost foto terbaik; captain kasih shout-out di grup WA.","duration":"Kam 15 Okt 20:00 – Min 18 Okt 23:55 WIB"}',
   '{"type":"riddle","max":10,"location_weight":50,"participation_weight":50,"tiers":[{"min":10,"pts":10},{"min":7,"pts":6},{"min":0,"pts":2}]}'),
  ('R4', 'main', 4, 'Scrapbook / Poster', 'scheduled', '2026-10-15 20:00+07', '2026-10-15 20:00+07', '2026-11-19 23:55+07', null, 0, 4, '{}', '{"type":"manual","max":30}'),
  ('R2', 'main', 2, 'Video Challenge', 'draft', '2026-10-22 20:00+07', '2026-10-25 00:00+07', '2026-11-01 23:55+07', null, 0, 2, '{}', '{"type":"manual","max":20}'),
  ('R3', 'main', 3, 'Spice It Up', 'draft', '2026-11-04 20:00+07', '2026-11-06 20:00+07', '2026-11-08 23:55+07', null, 0, 3, '{}', '{"type":"manual","max":20}'),
  ('R5', 'main', 5, 'Beyond UR', 'draft', null, null, null, null, 0, 5, '{}', '{"type":"manual","max":20}'),
  ('R6', 'main', 6, 'The Legacy Challenge', 'draft', null, null, null, null, 0, 6, '{}', '{"type":"manual","max":20}'),
  ('SQ1', 'side', null, 'Get To Know Me', 'live', '2026-10-08 20:00+07', '2026-10-08 20:00+07', '2026-11-19 23:55+07', null, 0, 7, '{}', '{"type":"flat","max":10}'),
  ('SQ2', 'side', null, 'Find Your Match', 'live', '2026-10-08 20:00+07', '2026-10-08 20:00+07', '2026-11-19 23:55+07', null, 0, 8, '{}', '{"type":"flat","max":15}'),
  ('SQ3', 'side', null, 'Connect 10', 'scheduled', '2026-10-22 20:00+07', '2026-10-22 20:00+07', '2026-11-19 23:55+07', null, 0, 9, '{}', '{"type":"flat","max":30}');

-- R1 riddle bank.
with r as (select id from public.challenges where code = 'R1'),
bank(no, prompt, answer) as (values
  (1, 'Aku menyambut semua orang, tapi tak pernah bicara. Dorong aku, maka kamu masuk.', 'Pintu kaca utama lobby'),
  (2, 'Di sini kopi dan cerita bertemu setelah ibadah.', 'Area cafe lantai 1'),
  (3, 'Anak-anak berlari ke sini, orang tua melepas dengan lambaian.', 'Kids check-in counter'),
  (4, 'Aku tinggi, penuh nama, tapi hanya dibaca saat menunggu.', 'Papan pengumuman dekat lift'),
  (5, 'Tangga yang paling sering dipakai tapi paling jarang difoto.', 'Tangga sisi timur'),
  (6, 'Aku menyimpan ribuan suara, tapi selalu diam di belakang.', 'Sound booth (FOH)'),
  (7, 'Kartu kecil berisi harapan berakhir di kotak ini.', 'Kotak connect card'),
  (8, 'Di atas semua kursi, aku menatap ke depan.', 'Balkon baris depan'),
  (9, 'Mobil berhenti, senyum pertama dimulai dari sini.', 'Drop-off area depan lobby'),
  (10, 'Tempat paling tenang untuk berdoa sebelum melayani.', 'Prayer room volunteer')),
ins as (insert into public.riddles (challenge_id, no, prompt) select r.id, b.no, b.prompt from r, bank b returning id, no)
insert into public.riddle_answers (riddle_id, answer) select ins.id, b.answer from ins join bank b using (no);

-- Flourish Hub · Mini Events from "Playbook - Welcome UR Outing 2026". Run after 0005_usernames.sql.
--   • "connect" challenges (Get to Know Me): every player submits answers about group-mates;
--     team score = average member score × individual weight + participation rate × participation weight.
--   • "rubric" challenges (Guess, Find, Snap! · Give and Grow): criteria per submission + one team
--     participation score from everyone tagged in the group's validated submissions.
--   • challenges.form: what the portal form asks for and what validators tick.
--   • profile_gtkm: Get to Know Me answers (Member Form), the key for Q1–Q3. Staff only.
--   • The playbook content for Mini Events #1, #2, #3 and #5; #4 (Spice It Up) only moves from R3 to R4.
-- The same rules run in the browser in demo mode (src/lib/game.js, src/lib/demoGame.js).

-- ───────────────────────── Columns ─────────────────────────
alter table public.challenges add column if not exists form jsonb not null default '{}'::jsonb;

alter table public.submissions
  add column if not exists target_id uuid references public.profiles on delete set null,  -- connect: the person described
  add column if not exists answers   jsonb,                                                -- connect: {q1..q4} · riddle: {answer}
  add column if not exists marks     jsonb;                                                -- validator's points per question / criterion
create index if not exists submissions_member_idx on public.submissions (challenge_id, submitted_by, target_id);

-- Get to Know Me answers from the Member Form. Never readable by members (it's the answer key).
create table if not exists public.profile_gtkm (
  profile_id uuid primary key references public.profiles on delete cascade,
  words      text,
  enjoy      text,
  talent     text,
  updated_at timestamptz not null default now()
);
alter table public.profile_gtkm enable row level security;
create policy "gtkm: staff read" on public.profile_gtkm for select to authenticated
  using (public.has_permission('submissions.validate') or public.has_permission('members.manage'));
create policy "gtkm: managers write" on public.profile_gtkm for all to authenticated
  using (public.has_permission('members.manage')) with check (public.has_permission('members.manage'));
create trigger profile_gtkm_touch before update on public.profile_gtkm for each row execute function public.touch_updated_at();

create or replace function public.is_connect(p_challenge uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select scoring->>'type' = 'connect' from challenges where id = p_challenge), false);
$$;

-- ───────────────────────── Submitting ─────────────────────────
-- Connect: any player submits for themselves about a group-mate (not themselves), each person once,
-- at most `people` people. Everything else: Group Leader (portal.submit) for the group.
-- Versions count up per riddle, per (member, person) for connect, or per group for single entries.
create or replace function public.prepare_submission()
returns trigger language plpgsql security definer set search_path = public as $$
declare c challenges; me profiles; t profiles; max_people int; n_active int;
begin
  select * into c from challenges where id = new.challenge_id;
  if c.status <> 'live' or (c.deadline_at is not null and now() > c.deadline_at) then
    raise exception 'Challenge ini sedang tidak menerima submission';
  end if;
  if auth.uid() is not null and new.group_no is distinct from my_group() then
    raise exception 'Hanya bisa submit untuk grup sendiri';
  end if;
  new.submitted_by := coalesce(auth.uid(), new.submitted_by);

  if c.scoring->>'type' = 'connect' then
    select * into me from profiles where id = new.submitted_by;
    if me.id is null or not me.active or me.is_committee or me.role_id not in ('member', 'group_leader') then
      raise exception 'Challenge ini untuk peserta grup';
    end if;
    select * into t from profiles where id = new.target_id;
    if t.id is null or t.id = me.id or t.group_no is distinct from new.group_no
       or not t.active or t.is_committee or t.role_id not in ('member', 'group_leader') then
      raise exception 'Pilih anggota grup kamu sendiri (bukan diri sendiri)';
    end if;
    -- Latest entry per person from this member: pending or validated ones count.
    if exists (select 1 from (select distinct on (s.target_id) s.target_id, s.status from submissions s
                              where s.challenge_id = c.id and s.submitted_by = me.id and s.target_id is not null
                              order by s.target_id, s.version desc) l
               where l.target_id = new.target_id and l.status in ('submitted', 'validated')) then
      raise exception 'Orang ini sudah kamu submit';
    end if;
    max_people := coalesce((c.scoring->>'people')::int, 2);
    select count(*) into n_active from (select distinct on (s.target_id) s.target_id, s.status from submissions s
                                        where s.challenge_id = c.id and s.submitted_by = me.id and s.target_id is not null
                                        order by s.target_id, s.version desc) l
    where l.status in ('submitted', 'validated') and l.target_id <> new.target_id;
    if n_active >= max_people then
      raise exception 'Maksimal % orang per member', max_people;
    end if;
    new.riddle_id := null;
  else
    if auth.uid() is not null and not has_permission('portal.submit') then
      raise exception 'Hanya Group Leader yang bisa submit challenge ini';
    end if;
    new.target_id := null;
  end if;

  new.status := 'submitted';
  new.submitted_at := now();
  new.reviewed_by := null; new.reviewed_at := null; new.score := null; new.checks := null; new.marks := null;
  new.location_correct := null; new.participant_count := null; new.override_note := null; new.reject_reason := null;
  new.version := coalesce((select max(s.version) from submissions s
                           where s.challenge_id = new.challenge_id and s.group_no = new.group_no
                             and s.riddle_id is not distinct from new.riddle_id
                             and s.target_id is not distinct from new.target_id
                             and (new.target_id is null or s.submitted_by = new.submitted_by)), 0) + 1;
  return new;
end $$;

-- Reviews stamp who/when; submission content (now including the person and the answers) stays as submitted.
create or replace function public.guard_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.challenge_id := old.challenge_id; new.group_no := old.group_no; new.riddle_id := old.riddle_id;
    new.target_id := old.target_id; new.answers := old.answers;
    new.version := old.version; new.submitted_by := old.submitted_by; new.submitted_at := old.submitted_at;
    new.media_path := old.media_path; new.media_name := old.media_name; new.ig_url := old.ig_url;
    new.tagged_ids := old.tagged_ids; new.declaration := old.declaration;
    new.reviewed_by := auth.uid();
  end if;
  new.reviewed_at := now();
  return new;
end $$;

-- Members see only their own entries in connect challenges (so answers can't be copied); staff see all.
drop policy if exists "submissions: read" on public.submissions;
create policy "submissions: read" on public.submissions for select to authenticated using (
  public.has_permission('submissions.validate') or public.has_permission('scores.view')
  or (group_no = public.my_group() and (not public.is_connect(challenge_id) or submitted_by = auth.uid())));
drop policy if exists "submissions: submit" on public.submissions;
create policy "submissions: submit" on public.submissions for insert to authenticated
  with check (public.has_permission('portal.submit') or (public.is_connect(challenge_id) and public.has_permission('portal.view')));

-- ───────────────────────── Scores ─────────────────────────
-- Leaderboard points per group per challenge (same rules as groupPoints() in src/lib/game.js):
--   riddle / flat / manual: sum of validated scores
--   rubric:  sum + the participation tier for everyone tagged across the group's validated submissions
--   connect: each member's best `people` entries; round(avg ÷ member max × individual weight, 1)
--            + round(members who took part ÷ players in the group × participation weight, 1)
create or replace function public.group_scores()
returns table (group_no text, challenge_id uuid, points numeric, validated int)
language sql stable security definer set search_path = public as $$
  with v as (
    select s.group_no, s.challenge_id, s.submitted_by, s.tagged_ids, coalesce(s.score, 0) as score,
           coalesce(c.scoring->>'type', 'riddle') as kind, c.scoring
    from submissions s join challenges c on c.id = s.challenge_id
    where s.status = 'validated' and c.status <> 'draft'
  ),
  roster as (
    select p.group_no, count(*) as n from profiles p
    where p.active and not p.is_committee and p.role_id in ('member', 'group_leader') and p.group_no is not null
    group by p.group_no
  ),
  plain as (
    select v.group_no, v.challenge_id, sum(v.score) as points, count(*)::int as validated
    from v where v.kind not in ('rubric', 'connect') group by 1, 2
  ),
  rubric as (
    select v.group_no, v.challenge_id, sum(v.score) as base, count(*)::int as validated
    from v where v.kind = 'rubric' group by 1, 2
  ),
  rubric_people as (
    select v.group_no, v.challenge_id, count(distinct t.id) as n
    from v cross join lateral unnest(v.tagged_ids) as t(id)
    where v.kind = 'rubric' group by 1, 2
  ),
  rubric_points as (
    select r.group_no, r.challenge_id, r.validated,
           r.base + coalesce((select (tier->>'pts')::numeric
                              from jsonb_array_elements(c.scoring->'participation'->'tiers') tier
                              where coalesce(rp.n, 0) >= (tier->>'min')::numeric
                              order by (tier->>'min')::numeric desc limit 1), 0) as points
    from rubric r join challenges c on c.id = r.challenge_id
    left join rubric_people rp on rp.group_no = r.group_no and rp.challenge_id = r.challenge_id
  ),
  ranked as (
    select v.*, row_number() over (partition by v.group_no, v.challenge_id, v.submitted_by order by v.score desc) as rn
    from v where v.kind = 'connect'
  ),
  member_totals as (
    select r.group_no, r.challenge_id, r.submitted_by, sum(r.score) as total, count(*)::int as cnt
    from ranked r where r.rn <= coalesce((r.scoring->>'people')::int, 2)
    group by 1, 2, 3
  ),
  conn as (
    select m.group_no, m.challenge_id, c.scoring, avg(m.total) as avg_total, count(*) as took, sum(m.cnt)::int as validated
    from member_totals m join challenges c on c.id = m.challenge_id
    group by m.group_no, m.challenge_id, c.scoring
  ),
  connect_points as (
    select k.group_no, k.challenge_id, k.validated,
      round(
        coalesce(round(k.avg_total
          / nullif(coalesce((k.scoring->>'people')::numeric, 2)
                   * ((select coalesce(sum((q->>'max')::numeric), 0) from jsonb_array_elements(k.scoring->'questions') q)
                      + coalesce((k.scoring->>'photo_bonus')::numeric, 0)), 0)
          * coalesce((k.scoring->>'individual_weight')::numeric, 70), 1), 0)
        + coalesce(round(least(1, k.took::numeric / nullif(ro.n, 0))
          * coalesce((k.scoring->>'participation_weight')::numeric, 30), 1), 0), 1) as points
    from conn k left join roster ro on ro.group_no = k.group_no
  )
  select group_no, challenge_id, points, validated from plain
  union all select group_no, challenge_id, points, validated from rubric_points
  union all select group_no, challenge_id, points, validated from connect_points;
$$;

-- ───────────────────────── Notifications ─────────────────────────
-- Review results name the member and the person for connect entries.
create or replace function public.notify_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare c challenges; r_no int; who text; whom text; label text;
begin
  if new.status = old.status or new.status = 'submitted' then return new; end if;
  select * into c from challenges where id = new.challenge_id;
  select no into r_no from riddles where id = new.riddle_id;
  select split_part(full_name, ' ', 1) into who from profiles where id = new.submitted_by;
  select split_part(full_name, ' ', 1) into whom from profiles where id = new.target_id;
  label := c.code || ' · ' || c.name || coalesce(' · Riddle ' || r_no, '')
        || case when new.target_id is not null then ' · ' || coalesce(who, '?') || ' → ' || coalesce(whom, '?') else '' end;
  if new.status = 'validated' then
    perform notify('review', 'Submission disetujui 🎉', label || ' tervalidasi: +' || coalesce(new.score::text, '0') || ' poin.', c.id, new.group_no, 'good', 'review:' || new.id || ':validated');
  elsif new.status = 'rejected' then
    perform notify('review', 'Submission ditolak', label || ': ' || coalesce(new.reject_reason, 'lihat detail') || '. Kirim ulang sebelum deadline.', c.id, new.group_no, 'bad', 'review:' || new.id || ':rejected');
  elsif new.status = 'resubmit' then
    perform notify('review', 'Diminta kirim ulang', label || ': ' || coalesce(new.reject_reason, 'lihat detail') || '.', c.id, new.group_no, 'warn', 'review:' || new.id || ':resubmit');
  end if;
  return new;
end $$;

-- Deadline reminders: for connect challenges, count players who haven't sent all their people yet.
create or replace function public.send_deadline_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare c record; g record; w record; left_n int; sent int := 0; is_conn boolean; ppl int;
begin
  for c in select * from challenges where status = 'live' and deadline_at > now() and deadline_at <= now() + interval '24 hours' loop
    is_conn := c.scoring->>'type' = 'connect';
    ppl := coalesce((c.scoring->>'people')::int, 2);
    -- Only the reminder for the window we're in: "24" between 24 h and 3 h out, "3" in the last 3 h.
    for w in select * from (values ('24'), ('3')) v(label)
             where (v.label = '3') = (c.deadline_at <= now() + interval '3 hours') loop
      for g in select no from groups loop
        if is_conn then
          select count(*) into left_n from profiles p
          where p.group_no = g.no and p.active and not p.is_committee and p.role_id in ('member', 'group_leader')
            and (select count(distinct s.target_id) from submissions s
                 where s.challenge_id = c.id and s.submitted_by = p.id and s.status in ('submitted', 'validated')) < ppl;
        elsif c.riddles_per_group > 0 then
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
            c.name || ': ' || case when is_conn then left_n || ' anggota belum submit ' || ppl || ' orang'
                                   when c.riddles_per_group > 0 then left_n || ' riddle belum dikirim'
                                   else 'grup kamu belum submit' end
              || '. Tutup ' || to_char(c.deadline_at at time zone 'Asia/Jakarta', 'DD Mon HH24:MI') || ' WIB.',
            c.id, g.no, 'warn', 'reminder' || w.label || ':' || c.id || ':' || g.no);
          sent := sent + 1;
        end if;
      end loop;
    end loop;
  end loop;
  return sent;
end $$;

-- ───────────────────────── Playbook content ─────────────────────────
-- Written for the seed from 0002 (no submissions yet). Side quests and the unused round go;
-- the riddle bank stays with its challenge row, which becomes R2 Guess, Find, Snap!
--   R1 Photo Challenge → R2 · R2 Video → R3 Give and Grow · R3 Spice It Up → R4 (content unchanged)
--   R4 Scrapbook → R5 Ingatlah hari ini · R5 Beyond UR → R1 Get to Know Me
delete from public.challenges where code in ('SQ1', 'SQ2', 'SQ3', 'R6');
update public.challenges set code = code || '_old' where code in ('R1', 'R2', 'R3', 'R4', 'R5');
update public.challenges set code = 'R4', round = 4, sort = 4 where code = 'R3_old';
delete from public.riddle_draws where challenge_id = (select id from public.challenges where code = 'R1_old');

-- Mini Event #1: Get to Know Me
update public.challenges set
  code = 'R1', kind = 'main', round = 1, sort = 1, name = 'Get to Know Me', status = 'live',
  announce_at = '2026-10-12 00:00+07', open_at = '2026-10-12 00:00+07', deadline_at = '2026-10-18 23:59+07', validate_by = '2026-10-19 23:59+07',
  riddles_per_group = 0, draw_seed = null, draw_locked = false,
  sections = $j${"game_idea":"Udah Kenal Belom? Get to know 2 people from your new group — people you don't normally interact with — and remember something meaningful about them. The challenge is to see whether you actually talked, listened, and discovered something new.","how_to_play":"1. PICK — Choose 2 people from your new group whom you don't normally interact with. You can choose any 2 people; there are no assigned pairs.\n2. TALK — Have a real conversation. Ask them about something they really enjoy, one thing people might not know about them, and their hidden talent.\n3. REMEMBER — After talking, answer 3 questions about each person:\n- Q1. What are 3 words they used to describe themselves?\n- Q2. What's something they really enjoy doing?\n- Q3. What's their hidden talent?\n4. DISCOVER — Q4. What's ONE thing you discovered about them that you didn't know before?\n5. SUBMIT — Submit each person's answers through Flourish Hub before the deadline.\nBONUS: Take a photo together and get +2 points per person.","rules":"- Each member must get to know 2 people from their new group.\n- The 2 people should be people they don't normally interact with / don't know well.\n- Members must actually talk to the person.\n- For each person, members answer 3 questions based on the existing Get to Know Me information.\n- Members answer 1 additional Discovery question based on their actual conversation.\n- All answers are open answers — no multiple choice.\n- Each person can only be submitted once by the same member.\n- Submission is done through Flourish Hub before the deadline.\n- Answers must be based on a real conversation and not copied from another member.\n- Keep discoveries appropriate and respectful — no sensitive/personal information.","connection":"Connection > Competition. The goal isn't to get to know most people. It's to actually know someone a little better.","points_rewards":"- Q1–Q3 (knowledge), 2 pts each: 2 = clearly matches their Get to Know Me answer · 1 = close enough · 0 = incorrect or blank.\n- Q4 (discovery), 4 pts: 4 = specific, genuine and learned in the conversation · 2 = relevant but too generic · 0 = blank, irrelevant or copied from their profile.\n- Photo together: +2 per person (optional, no penalty). One clear photo of the two of you, taken during/around the conversation.\n- Max 12 per person, 24 per member (2 people).\n- Team score = (average member score ÷ 24 × 70) + (participation rate × 30), max 100. The average counts members who took part; participation rate = members who submitted ÷ team size.","flourish_hub":"Every member submits for themselves: pick the person, answer Q1–Q4, and add an optional photo together. One submission per person, 2 people per member.","make_it_flourish":"Let's meet. Let's connect. Let's flourish together.","duration":"12–18 October 2026 · deadline Sunday 18 October, 23:59 WIB."}$j$::jsonb,
  scoring = $j${"type":"connect","people":2,"photo_bonus":2,"individual_weight":70,"participation_weight":30,"questions":[{"key":"q1","text":"What are 3 words they used to describe themselves?","max":2,"ref":"words"},{"key":"q2","text":"What's something they really enjoy doing?","max":2,"ref":"enjoy"},{"key":"q3","text":"What's their hidden talent?","max":2,"ref":"talent"},{"key":"q4","text":"What's ONE thing you discovered about them that you didn't know before?","max":4}]}$j$::jsonb,
  form = $j${"photo":"optional","link":"none","tags":false,"confirm":["Jawaban saya dari obrolan langsung dengan orang ini, bukan disalin dari member lain","Discovery saya pantas & menghormati — tanpa informasi sensitif/pribadi"],"checks":["Orangnya satu grup dengan yang submit","Jawaban dari obrolan asli, tidak disalin","Konten pantas & tidak sensitif"],"reasons":["Jawaban disalin / bukan dari obrolan asli","Bukan anggota grup yang sama","Konten tidak pantas / terlalu pribadi","Orang yang sama sudah disubmit"]}$j$::jsonb
where code = 'R5_old';

-- Mini Event #2: Guess, Find, Snap!
update public.challenges set
  code = 'R2', kind = 'main', round = 2, sort = 2, name = 'Guess, Find, Snap!', status = 'scheduled',
  announce_at = '2026-10-21 00:00+07', open_at = '2026-10-21 00:00+07', deadline_at = '2026-10-25 23:59+07', validate_by = '2026-10-26 23:59+07',
  riddles_per_group = 4, draw_seed = null, draw_locked = false,
  sections = $j${"game_idea":"Get your team to work together, explore, and create a shared moment. GUESS what the clue is describing, FIND the answer around you, SNAP it as a team. The goal isn't just the correct answer — it's collaborating, having fun, and creating a memory together.","how_to_play":"1. GET YOUR CLUES — Each team receives 4 random riddles/clues. Each clue describes something you need to find.\n2. GUESS — Read the clue together and figure out what the answer could be.\n3. FIND — Go around the church and find the actual object/place/thing described by the clue.\n4. SNAP — Take a photo showing the correct answer. The photo should clearly prove that your team found it.\n5. SUBMIT — The Group Leader submits each clue through Flourish Hub: the answer, its photo, and the IG Story link.\n6. GET VALIDATED — The Captain checks the submission based on the challenge rules.","rules":"- Each team receives 4 random clues.\n- The team must solve all 4 clues.\n- Each answer must be supported by a photo.\n- The photo must clearly show the correct answer.\n- Photos should be taken by the team during the challenge — no old photos.\n- Team members should participate in the challenge, not just have one person do everything.\n- The required IG Story must be uploaded and tag the official event account.\n- The Group Leader is responsible for submitting the final answers through Flourish Hub.\n- The Captain validates the submission.\n- Keep everything safe, respectful, and within the church area.\n- No inappropriate content or photos of people who haven't given permission.","connection":"The goal isn't just to find the answer. It's to find it together.","points_rewards":"- Each correct photo: 10 pts (the photo clearly shows the correct answer). Wrong or invalid: 0.\n- No creativity scoring: the validator only checks whether the team found and captured the correct answer.\n- Team participation: 10–14 members → 10 pts · 7–9 → 6 · 6 or fewer → 2.\n- Max 4 × 10 + 10 = 50. Example: 3 correct + 12 of 13 members took part → 30 + 10 = 40/50.","flourish_hub":"The Group Leader submits per clue: your answer, a photo that proves it, the IG Story link, and tags everyone who took part. Participation counts everyone tagged across your validated photos.","make_it_flourish":"GUESS. FIND. SNAP. Let's flourish together!","duration":"21–25 October 2026 · deadline Sunday 25 October, 23:59 WIB."}$j$::jsonb,
  scoring = $j${"type":"rubric","criteria":[{"key":"correct","label":"Jawaban benar & foto jelas membuktikan","max":10,"binary":true}],"participation":{"tiers":[{"min":10,"pts":10},{"min":7,"pts":6},{"min":0,"pts":2}]}}$j$::jsonb,
  form = $j${"photo":"required","link":"required","link_label":"Link IG Story","answer_label":"Jawaban kalian","tag_label":"Siapa aja yang ikut?","confirm":["Foto diambil tim saat challenge ini (bukan foto lama)","IG Story sudah diupload & tag akun event","Pantas & menghormati — tanpa foto orang yang belum memberi izin"],"checks":["Foto jelas menunjukkan jawaban","Foto diambil saat challenge (bukan foto lama)","Jawaban sesuai clue & foto","IG Story sudah tag akun event","Pantas & tanpa wajah orang tanpa izin"],"reasons":["IG tag tidak ada","Foto tidak jelas","Foto lama / bukan saat challenge","Indikasi AI / edit","Wajah orang tanpa izin"]}$j$::jsonb
where code = 'R1_old';

-- Mini Event #3: Give and Grow
update public.challenges set
  code = 'R3', kind = 'main', round = 3, sort = 3, name = 'Give and Grow', status = 'scheduled',
  announce_at = '2026-10-28 00:00+07', open_at = '2026-10-28 00:00+07', deadline_at = '2026-11-01 23:59+07', validate_by = '2026-11-02 23:59+07',
  riddles_per_group = 0, draw_seed = null, draw_locked = false,
  sections = $j${"game_idea":"Share something that can help, teach, or inspire someone else. Everyone has something they know that someone else might not. Your team's mission is to create a short video that shares something useful, meaningful, or interesting with the rest of the Welcome community.","how_to_play":"1. CHOOSE — As a team, choose ONE thing worth sharing, for example:\n- something people don't know about serving\n- your volunteer role\n- a useful serving tip\n- how something works\n- a practical lesson you've learned\n- a fun / interesting fact\n- a meaningful serving experience\n2. CREATE — Create ONE short video as a team: clear, useful/meaningful, fun & engaging. Maximum 1 minute.\n3. SHARE — Upload the video to Instagram Story and tag the official event account.\n4. SUBMIT — The Group Leader submits the video link through Flourish Hub before the deadline.\n5. GROW — Watch what other teams share and learn something new from them.","rules":"- Each team submits ONE video.\n- The maximum video length is 1 minute.\n- Content must be useful, meaningful, educational, or something others can learn from.\n- The video should involve the team — don't leave everything to one person.\n- Upload the video to Instagram Story and tag the official event account as instructed.\n- Submit the video through Flourish Hub before the deadline.\n- Keep the content appropriate and respectful.\n- Do not show people's faces without permission.\n- Do not mention the organization's name (JPCC) in the video.\n- Keep it simple — content matters more than production quality.","connection":"The scoring rewards BOTH the quality of sharing and team participation. A polished video alone is not enough.","points_rewards":"- Video score (max 50): challenge & topic fit 20 · useful / meaningful content 15 · clear & easy to understand 10 · team involvement / execution 5.\n- Participation (max 50): 10–14 members → 50 · 7–9 → 35 · 6 or fewer → 20.\n- Max 100. Example: video 46 + 11 members took part (50) = 96/100.","flourish_hub":"The Group Leader pastes the video link (IG Story or Google Drive) and tags everyone who took part. No upload needed.","duration":"28 October – 1 November 2026 · deadline Sunday 1 November, 23:59 WIB."}$j$::jsonb,
  scoring = $j${"type":"rubric","criteria":[{"key":"fit","label":"Challenge & topic fit","max":20,"hint":"Clearly follows Give & Grow and shares one focused topic."},{"key":"useful","label":"Useful / meaningful content","max":15,"hint":"Gives viewers something useful, meaningful, educational, or interesting."},{"key":"clear","label":"Clear & easy to understand","max":10,"hint":"Easy to understand, concise, and within the 1-minute limit."},{"key":"team","label":"Team involvement / execution","max":5,"hint":"Shows genuine team involvement and is properly submitted."}],"participation":{"tiers":[{"min":10,"pts":50},{"min":7,"pts":35},{"min":0,"pts":20}]}}$j$::jsonb,
  form = $j${"photo":"none","link":"required","link_label":"Link video (IG Story / Google Drive)","tag_label":"Siapa aja yang ikut?","confirm":["Video maksimal 1 menit","Video sudah diupload ke IG Story & tag akun event","Tidak menyebut JPCC & tidak ada wajah orang tanpa izin"],"checks":["Satu video per tim","Maksimal 1 menit","IG Story sudah tag akun event","Tanpa wajah orang tanpa izin","Tidak menyebut JPCC"],"reasons":["Lebih dari 1 menit","IG tag tidak ada","Link tidak bisa dibuka","Wajah orang tanpa izin","Menyebut JPCC"]}$j$::jsonb
where code = 'R2_old';

-- Mini Event #5: Ingatlah hari ini
update public.challenges set
  code = 'R5', kind = 'main', round = 5, sort = 5, name = 'Ingatlah hari ini', status = 'scheduled',
  announce_at = '2026-10-12 00:00+07', open_at = '2026-11-10 00:00+07', deadline_at = '2026-11-15 23:59+07', validate_by = '2026-11-16 23:59+07',
  riddles_per_group = 0, draw_seed = null, draw_locked = false,
  sections = $j${"game_idea":"Your team scrapbook / poster of the Flourish Together journey: the photos, moments, quotes and stories you collected along the way.","how_to_play":"1. COLLECT — Gather photos, moments, quotes or stories from the journey (11–13 November).\n2. CREATE — Arrange your memories into one team scrapbook / poster (11–15 November).\n3. SUBMIT — The Group Leader submits the final scrapbook through Flourish Hub by 15 November, 23:59 WIB.\nThe full format, rules and scoring will be announced by the committee before the challenge opens.","rules":"Rules will be announced before the challenge opens on 10 November.","points_rewards":"Scoring will be announced before the challenge opens.","make_it_flourish":"Selected memories may be showcased at the Main Event on 21 November.","duration":"Opens 10 November · deadline Sunday 15 November 2026, 23:59 WIB."}$j$::jsonb,
  scoring = $j${"type":"manual","max":30,"tba":true}$j$::jsonb,
  form = $j${"photo":"required","link":"optional","link_label":"Link file scrapbook (opsional)","tag_label":"Siapa aja yang ikut?"}$j$::jsonb
where code = 'R4_old';


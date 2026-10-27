// Database schema + first-run seed. Runs on every cold start; everything is idempotent.
// Access rules live in the API (server/rpc.js), not in the database.
import { PERMISSIONS, ROLES, DEFAULT_GRANTS } from '../src/lib/permissions.js';
import { PLAYBOOK } from '../src/lib/playbook.js';
import { PALETTE } from '../src/lib/roster.js';
import { RIDDLES } from '../src/data.js';
import { createHmac } from 'node:crypto';
import { hashPassword, sessionSecret } from './auth.js';

const SCHEMA = `
create table if not exists app_meta (key text primary key, value text not null);

create table if not exists roles (id text primary key, name text not null, description text, sort int not null default 0);
create table if not exists permissions (id text primary key, label text not null, category text not null, sort int not null default 0);
create table if not exists role_permissions (
  role_id text not null references roles on delete cascade,
  permission_id text not null references permissions on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists groups (
  no text primary key check (no ~ '^[0-9]{2,3}$'),
  name text not null,
  color text not null,
  min_size int not null default 12,
  max_size int not null default 14,
  sort int not null default 0,
  locked_at timestamptz,
  locked_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9._]{2,23}$'),
  password_hash text,
  session_epoch timestamptz not null default '2000-01-01',   -- sessions issued before this are invalid
  email text,
  contact_email text,
  full_name text,
  role_id text not null default 'member' references roles,
  group_no text references groups on update cascade on delete set null,
  service_team text,
  position text,
  ministry_role text,
  is_ministry_tl boolean not null default false,
  is_committee boolean not null default false,
  ig_handle text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profile_gtkm (
  profile_id uuid primary key references profiles on delete cascade,
  words text, enjoy text, talent text,
  updated_at timestamptz not null default now()
);

create table if not exists login_attempts (username text not null, at timestamptz not null default now());
create index if not exists login_attempts_idx on login_attempts (username, at);

create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null default 'main' check (kind in ('main', 'side')),
  round int,
  name text not null,
  pic_id uuid references profiles on delete set null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'live', 'closed', 'published')),
  announce_at timestamptz, open_at timestamptz, deadline_at timestamptz, validate_by timestamptz,
  sections jsonb not null default '{}', scoring jsonb not null default '{"type":"manual","max":20}', form jsonb not null default '{}',
  riddles_per_group int not null default 0 check (riddles_per_group between 0 and 10),
  draw_seed int, draw_locked boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists riddles (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges on delete cascade,
  no int not null,
  prompt text not null,
  answer text not null default '',
  unique (challenge_id, no)
);

create table if not exists riddle_draws (
  challenge_id uuid not null references challenges on delete cascade,
  group_no text not null references groups on update cascade on delete cascade,
  slot int not null,
  riddle_id uuid not null references riddles on delete cascade,
  primary key (challenge_id, group_no, slot)
);

-- Submission photos (already shrunk in the browser to ~0.5 MB).
create table if not exists media (
  path text primary key,
  group_no text,
  mime text not null,
  bytes bytea not null,
  created_at timestamptz not null default now()
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges on delete cascade,
  group_no text not null references groups on update cascade,
  riddle_id uuid references riddles on delete set null,
  target_id uuid references profiles on delete set null,
  version int not null default 1,
  status text not null default 'submitted' check (status in ('submitted', 'validated', 'rejected', 'resubmit')),
  submitted_by uuid references profiles on delete set null,
  submitted_at timestamptz not null default now(),
  media_path text, media_name text, ig_url text,
  tagged_ids jsonb not null default '[]',
  answers jsonb,
  declaration boolean not null default false,
  reviewed_by uuid references profiles on delete set null,
  reviewed_at timestamptz,
  checks jsonb, marks jsonb,
  location_correct boolean, participant_count int,
  score numeric(6,2),
  override_note text, reject_reason text
);
-- Set when a Super Admin / PIC reopens a validated submission: editable again (even past the deadline) until re-validated.
alter table submissions add column if not exists reopened_at timestamptz;
-- Scores keep 3 decimals (riddle Skenario 1: 9 of 12 in the photo = 9.375).
do $$ begin
  if (select numeric_scale from information_schema.columns where table_name = 'submissions' and column_name = 'score') <> 3 then
    alter table submissions alter column score type numeric(7,3);
  end if;
end $$;
-- Point changes by a Super Admin / PIC after validation: [{from, to, note, by, by_name, at}].
alter table submissions add column if not exists adjustments jsonb not null default '[]';
create index if not exists submissions_challenge_idx on submissions (challenge_id, status);
create index if not exists submissions_group_idx on submissions (group_no);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('review', 'challenge', 'reminder')),
  title text not null,
  body text,
  challenge_id uuid references challenges on delete cascade,
  group_no text references groups on update cascade on delete cascade,   -- null = everyone
  tone text not null default 'info',
  dedupe_key text unique,
  created_at timestamptz not null default now()
);
create table if not exists notification_reads (
  user_id uuid not null references profiles on delete cascade,
  notification_id uuid not null references notifications on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);
`;

const wib = (s) => (s ? new Date(s + ':00+07:00').toISOString() : null);

// Only this server may touch the data. Hosted Postgres (e.g. Supabase) also publishes the "public" tables
// through a web API for its anon/authenticated roles: row-level security with no policies + revoked rights
// shuts that door. The server connects as the tables' owner, which row-level security doesn't restrict.
const TABLES = ['app_meta', 'roles', 'permissions', 'role_permissions', 'groups', 'profiles', 'profile_gtkm', 'login_attempts',
  'challenges', 'riddles', 'riddle_draws', 'media', 'submissions', 'notifications', 'notification_reads'];
const LOCKDOWN = `${TABLES.map((t) => `alter table ${t} enable row level security;`).join('\n')}
do $$ declare r text; begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on ${TABLES.join(', ')} from %I', r);
    end if;
  end loop;
end $$;`;

export async function migrate(db) {
  await db.exec(SCHEMA);
  await db.exec(LOCKDOWN);
  const { rows } = await db.query(`select value from app_meta where key = 'seeded'`);
  if (!rows.length) await db.tx((t) => seed(t));
  await updateTexts(db);
  await r2Proportional(db);
  await r3GiveGrow(db);
  await r3Reels(db);
  await r4Form(db);
  await bootstrapAdmins(db);
}

async function seed(t) {
  for (const [i, r] of ROLES.entries()) {
    await t.query('insert into roles (id, name, description, sort) values ($1,$2,$3,$4) on conflict (id) do nothing', [r.id, r.name, r.description, i + 1]);
  }
  for (const [i, p] of PERMISSIONS.entries()) {
    await t.query('insert into permissions (id, label, category, sort) values ($1,$2,$3,$4) on conflict (id) do nothing', [p.id, p.label, p.category, i + 1]);
  }
  for (const [role, perms] of Object.entries(DEFAULT_GRANTS)) {
    for (const p of perms) await t.query('insert into role_permissions values ($1,$2) on conflict do nothing', [role, p]);
  }
  for (let i = 0; i < 10; i++) {
    await t.query('insert into groups (no, name, color, sort) values ($1,$2,$3,$4) on conflict (no) do nothing',
      [String(i + 1).padStart(2, '0'), `Group ${i + 1}`, PALETTE[i], i + 1]);
  }
  // Mini Events from the playbook (#1, #2, #3, #5) + #4 Spice It Up as a draft.
  const challenges = [
    ...PLAYBOOK.map(({ schedule, ...c }) => ({ ...c, schedule })),
    { code: 'R4', kind: 'main', round: 4, name: 'Spice It Up', status: 'draft', sort: 4, riddles_per_group: 0,
      schedule: ['2026-11-04T20:00', '2026-11-06T20:00', '2026-11-08T23:55', null], sections: {}, scoring: { type: 'manual', max: 20 }, form: {} },
  ];
  for (const c of challenges) {
    const [a, o, d, v] = c.schedule;
    const { rows: [row] } = await t.query(
      `insert into challenges (code, kind, round, name, status, announce_at, open_at, deadline_at, validate_by, sections, scoring, form, riddles_per_group, sort)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) on conflict (code) do nothing returning id`,
      [c.code, c.kind, c.round, c.name, c.status, wib(a), wib(o), wib(d), wib(v), JSON.stringify(c.sections || {}), JSON.stringify(c.scoring), JSON.stringify(c.form || {}), c.riddles_per_group || 0, c.sort]);
    if (row && c.code === 'R2') {
      for (const [i, [prompt, answer]] of RIDDLES.entries()) {
        await t.query('insert into riddles (challenge_id, no, prompt, answer) values ($1,$2,$3,$4)', [row.id, i + 1, prompt, answer]);
      }
    }
  }
  await t.query(`insert into app_meta values ('seeded', $1) on conflict (key) do nothing`, [new Date().toISOString()]);
}

// Wording changes to seeded challenge text. Each replaces one exact line, so a line an admin edited stays theirs.
const TEXT_UPDATES = [
  // Oct 2026: participation now counts people interviewed too.
  ['R1', 'points_rewards', "- Team score = (average member score ÷ 24 × 70) + (participation rate × 30), max 100. The average counts members who took part; participation rate = members who submitted ÷ team size.",
    "- Team score = (average member score ÷ 24 × 70) + (participation rate × 30), max 100. The average counts members who took part; participation rate = (members who submitted + members who were interviewed) ÷ team size × ½."],
  // Oct 2026: R2 participation = members the Group Leader selects (not a headcount from the photo).
  ['R2', 'points_rewards', "- Per riddle (4 riddle), max 25 pts: correct answer = 12.5 pts, plus participation = members in the photo ÷ team size × 12.5.", "- Per riddle (4 riddle), max 25 pts: correct answer = 12.5 pts, plus participation = members who took part ÷ team size × 12.5."],
  ['R2', 'points_rewards', "- Participation is counted per photo: each riddle's photo is validated on its own.", "- Participation is counted per riddle: the Group Leader submits and selects by name who took part (captains don't count)."],
];
// Oct 2026: R2 switches to "Skenario 1 — Proportional" scoring. Once, and only while it still has the seeded rubric
// and no validated submissions.
async function r2Proportional(db) {
  const { rows } = await db.query(`select value from app_meta where key = 'r2_proportional'`);
  if (rows.length) return;
  await db.query(`update challenges c set scoring = $1::jsonb,
      sections = jsonb_set(sections, '{points_rewards}', to_jsonb($2::text))
    where c.code = 'R2' and c.scoring->>'type' = 'rubric'
      and not exists (select 1 from submissions s where s.challenge_id = c.id and s.status = 'validated')`,
  [JSON.stringify({ type: 'proportional', answer_pts: 12.5, participation_pts: 12.5 }), "- Per riddle (4 riddle), max 25 pts: correct answer = 12.5 pts, plus participation = members who took part ÷ team size × 12.5.\n- Participation is counted per riddle: the Group Leader submits and selects by name who took part (captains don't count).\n- Max 4 × 12.5 (answers) + 4 × 12.5 (participation) = 100. Example (12 members): 12, 9, 10 and 6 in the photos → 12.5 + 9.38 + 10.42 + 6.25 = 38.54; 3 correct answers → 37.5; total 76.0."]);
  await db.query(`insert into app_meta values ('r2_proportional', $1) on conflict (key) do nothing`, [new Date().toISOString()]);
}
// Oct 2026: R3 "Give and Grow" gets its updated rules (offline/online participation, BTS) and runs to 8 Nov.
// Once, and only while nothing in R3 is validated.
async function r3GiveGrow(db) {
  const { rows } = await db.query(`select value from app_meta where key = 'r3_give_grow'`);
  if (rows.length) return;
  await db.query(`update challenges c set scoring = $1::jsonb, form = $2::jsonb, sections = $3::jsonb,
      deadline_at = $4, validate_by = $5, updated_at = now()
    where c.code = 'R3' and c.scoring->>'type' <> 'give_grow'
      and not exists (select 1 from submissions s where s.challenge_id = c.id and s.status = 'validated')`,
  ["{\"type\":\"give_grow\",\"criteria\":[{\"key\":\"fit\",\"label\":\"Challenge & fit\",\"max\":20,\"hint\":\"Follows Give and Grow and one clear theme.\"},{\"key\":\"useful\",\"label\":\"Useful / meaningful content\",\"max\":15,\"hint\":\"Gives viewers a meaningful lesson or practical insight.\"},{\"key\":\"clear\",\"label\":\"Clarity (easy to understand)\",\"max\":10,\"hint\":\"Easy to follow and within 60 seconds.\"},{\"key\":\"team\",\"label\":\"Team involvement / execution\",\"max\":5,\"hint\":\"Shows genuine team involvement in the making.\"}],\"overall_pts\":40,\"offline_pts\":5,\"bts_photo_pts\":2,\"bts_video_pts\":5}", "{\"photo\":\"none\",\"link\":\"required\",\"link_label\":\"Link video resmi tim (maks 60 detik)\",\"answer_label\":\"Link BTS (foto / video, mis. Google Drive)\",\"answer_optional\":true,\"tags\":true,\"tags_optional\":true,\"tag_label\":\"Siapa yang ikut OFFLINE (terlibat shooting, ada di BTS)?\",\"confirm\":[\"Satu video resmi tim, maksimal 60 detik\",\"Anggota offline benar-benar terlibat shooting / produksi (terdokumentasi di BTS)\"],\"checks\":[\"Satu video resmi, maks 60 detik\",\"Sesuai tema Give and Grow\",\"BTS menunjukkan anggota yang terlibat\",\"Reel publik & tag akun resmi\",\"Pantas & tanpa wajah orang tanpa izin\"],\"reasons\":[\"Lebih dari 60 detik\",\"Link tidak bisa dibuka\",\"Tema tidak sesuai\",\"BTS tidak ada / tidak jelas\",\"Wajah orang tanpa izin\"],\"reel_link_label\":\"Link Reels Instagram (diupload di akun IG pribadi)\",\"reel_hint\":\"Tempel link REELS (bukan IG Story) yang kamu upload di akun Instagram pribadi: 15–60 detik, sesuai tema Give and Grow.\",\"reel_confirm\":[\"Satu video resmi tim, maksimal 60 detik\",\"IG tidak diprivate dan sudah ditag ke akun IG flourishtogether.ur\"],\"reel_checks\":[\"Reels (bukan IG Story), 15–60 detik\",\"Akun IG pribadi & tidak diprivate\",\"Sudah tag akun IG flourishtogether.ur\",\"Sesuai tema Give and Grow\"],\"reel_reasons\":[\"Bukan Reels (IG Story)\",\"Akun IG diprivate\",\"Tidak tag flourishtogether.ur\",\"Durasi tidak sesuai\",\"Tema tidak sesuai\",\"Link tidak bisa dibuka\"]}", "{\"game_idea\":\"Share a meaningful lesson or practical insight that can help others grow — as a team, in a short video of maximum 60 seconds.\",\"how_to_play\":\"1. CHOOSE A THEME — pick one of the suggested themes, or propose your own theme for committee approval (proposals by 30 Oct, approval 31 Oct):\\n- The Art of Welcoming\\n- Little Things That Make a Difference\\n- Lessons from Serving\\n- Something We Wish Everyone Knew\\n2. SHOOT TOGETHER — make one official team video (max 60 seconds). Members take real roles in the offline shooting: acting, camera, directing, lighting, on-site production help.\\n3. DOCUMENT — capture behind-the-scenes (BTS) photos or video that show who was involved in the shooting.\\n4. ONLINE ALTERNATIVE — members who could not join the offline shooting may post an individual Instagram Reel (15–60 seconds) on the Give and Grow theme.\\n5. SUBMIT — by 8 Nov the Group Leader submits the official video link, the BTS link and the members who took part offline; each member who posted a Reel submits their own Reel link in Flourish Hub.\",\"rules\":\"A. Official team video\\n- Each team submits ONE official video for scoring. Additional videos are allowed but earn no extra video points.\\n- Maximum duration: 60 seconds.\\nB. Offline participation\\n- Members must be directly involved in the offline shooting or production: acting, camera operation, directing, lighting, on-site production assistance.\\n- Each team submits behind-the-scenes (BTS) documentation showing the members involved in the shooting.\\n- Members do not need to appear in the final video if their production involvement is documented.\\n- Merely attending, being listed as a team member, or claiming a role without actual involvement does not qualify.\\n- Editing, scripting, subtitles and other online-only tasks do not count as offline participation.\\nC. Online participation — individual Instagram Reel\\n- Members who do not qualify for offline participation may post an individual Instagram Reel instead.\\n- The Reel must be 15–60 seconds, relevant to the Give and Grow theme, posted on an existing personal Instagram account, publicly accessible, and tag the official Flourish Together Instagram account.\\n- The Reel link must be given to the committee for validation. No new Instagram account is needed.\\nD. One member, one participation credit\\n- Each member gets participation credit only once, however many shooting sessions or Reels.\\n- A member who qualifies offline gets no extra credit for also posting a Reel.\\n- Offline and online participation count the same for the participation rate.\",\"connection\":\"Participation credit is based on verified involvement — not attendance, assigned roles, or the number of submissions. Offline shooting participation and a valid individual Instagram Reel are alternative routes to the same participation credit.\",\"points_rewards\":\"- Official team video (max 50): challenge & fit 20 · useful / meaningful content 15 · clarity (easy to understand) 10 · team involvement / execution 5.\\n- Participation (max 50):\\n- Overall participation rate (max 40) = unique validated participants (offline + online, each member once) ÷ total team members × 40.\\n- Offline participation (+5) if the team has at least one validated offline participant.\\n- Behind the scenes (max 5): BTS photos (at least 3) = 2 · BTS video (at least 15 seconds) = 5. Photos + video still count 5.\\n- Max 100. Example (12 members): video 42 + 9 of 12 took part (30) + offline 5 + BTS video 5 = 82.\",\"flourish_hub\":\"Group Leader: submit once for the team — the official video link (max 60 s), the BTS link (e.g. Google Drive) and the members who took part offline. Members with an individual Reel: open Give and Grow → \\\"Reels kamu\\\" and submit your own Reels link (Reels on your personal Instagram, not IG Story; account not private; tag @flourishtogether.ur). The committee verifies everyone; unverified claims are not counted.\",\"what_we_need\":\"- 30 Oct: deadline for proposed themes · 31 Oct: theme approval\\n- 8 Nov, 23:59 WIB: final video, BTS documentation and Instagram Reel links\\n- 9 Nov: participation validation · 10 Nov: scoring · 11 Nov: winner announcement\",\"duration\":\"28 October – 8 November 2026 · deadline Sunday 8 November, 23:59 WIB.\"}", wib("2026-11-08T23:59"), wib("2026-11-10T23:59")]);
  await db.query(`insert into app_meta values ('r3_give_grow', $1) on conflict (key) do nothing`, [new Date().toISOString()]);
}
// Oct 2026: R3 online participation = each member submits their own Reels (not listed by the leader).
async function r3Reels(db) {
  const { rows } = await db.query(`select value from app_meta where key = 'r3_reels'`);
  if (rows.length) return;
  await db.query(`update challenges set form = $1::jsonb,
      sections = jsonb_set(jsonb_set(sections, '{flourish_hub}', to_jsonb($2::text)), '{how_to_play}', to_jsonb(replace(sections->>'how_to_play', $3, $4))),
      updated_at = now()
    where code = 'R3' and scoring->>'type' = 'give_grow'`, ["{\"photo\":\"none\",\"link\":\"required\",\"link_label\":\"Link video resmi tim (maks 60 detik)\",\"answer_label\":\"Link BTS (foto / video, mis. Google Drive)\",\"answer_optional\":true,\"tags\":true,\"tags_optional\":true,\"tag_label\":\"Siapa yang ikut OFFLINE (terlibat shooting, ada di BTS)?\",\"confirm\":[\"Satu video resmi tim, maksimal 60 detik\",\"Anggota offline benar-benar terlibat shooting / produksi (terdokumentasi di BTS)\"],\"checks\":[\"Satu video resmi, maks 60 detik\",\"Sesuai tema Give and Grow\",\"BTS menunjukkan anggota yang terlibat\",\"Reel publik & tag akun resmi\",\"Pantas & tanpa wajah orang tanpa izin\"],\"reasons\":[\"Lebih dari 60 detik\",\"Link tidak bisa dibuka\",\"Tema tidak sesuai\",\"BTS tidak ada / tidak jelas\",\"Wajah orang tanpa izin\"],\"reel_link_label\":\"Link Reels Instagram (diupload di akun IG pribadi)\",\"reel_hint\":\"Tempel link REELS (bukan IG Story) yang kamu upload di akun Instagram pribadi: 15–60 detik, sesuai tema Give and Grow.\",\"reel_confirm\":[\"Satu video resmi tim, maksimal 60 detik\",\"IG tidak diprivate dan sudah ditag ke akun IG flourishtogether.ur\"],\"reel_checks\":[\"Reels (bukan IG Story), 15–60 detik\",\"Akun IG pribadi & tidak diprivate\",\"Sudah tag akun IG flourishtogether.ur\",\"Sesuai tema Give and Grow\"],\"reel_reasons\":[\"Bukan Reels (IG Story)\",\"Akun IG diprivate\",\"Tidak tag flourishtogether.ur\",\"Durasi tidak sesuai\",\"Tema tidak sesuai\",\"Link tidak bisa dibuka\"]}", "Group Leader: submit once for the team — the official video link (max 60 s), the BTS link (e.g. Google Drive) and the members who took part offline. Members with an individual Reel: open Give and Grow → \"Reels kamu\" and submit your own Reels link (Reels on your personal Instagram, not IG Story; account not private; tag @flourishtogether.ur). The committee verifies everyone; unverified claims are not counted.", "5. SUBMIT — by 8 Nov the Group Leader submits in Flourish Hub: the official video link, the BTS link, the members who took part offline, and the members who posted a Reel (with their Reel links).", "5. SUBMIT — by 8 Nov the Group Leader submits the official video link, the BTS link and the members who took part offline; each member who posted a Reel submits their own Reel link in Flourish Hub."]);
  await db.query(`insert into app_meta values ('r3_reels', $1) on conflict (key) do nothing`, [new Date().toISOString()]);
}
// Oct 2026: R4 submit form wording — "Cover" / "Upload disini", scrapbook link required, "Siapa aja yang terlibat?",
// rules without the IG Story point and with a short "Deklarasi No-AI". Once; other R4 settings are kept.
async function r4Form(db) {
  const { rows } = await db.query(`select value from app_meta where key = 'r4_form_v1'`);
  if (rows.length) return;
  const { rows: [c] } = await db.query(`select id, form from challenges where code = 'R4'`);
  if (c) {
    const form = c.form || {};
    const base = form.confirm?.length ? form.confirm : [
      'Semua orang di foto adalah anggota {grup}',
      'IG Story sudah tag akun event',
      'Tidak menyebut nama gereja & tidak ada wajah jemaat tanpa izin',
      'Deklarasi No-AI',
    ];
    // drop point 2 (IG Story), point 4 becomes just "Deklarasi No-AI"
    const confirm = base.length >= 4 ? [base[0], base[2], 'Deklarasi No-AI', ...base.slice(4)] : base.filter((r) => !/ig story/i.test(r));
    const next = { ...form, photo_label: 'Cover', photo_pick_label: 'Upload disini', link: 'required', tag_label: 'Siapa aja yang terlibat?', confirm };
    await db.query('update challenges set form = $2::jsonb, updated_at = now() where id = $1', [c.id, JSON.stringify(next)]);
  }
  await db.query(`insert into app_meta values ('r4_form_v1', $1) on conflict (key) do nothing`, [new Date().toISOString()]);
}
async function updateTexts(db) {
  for (const [code, key, from, to] of TEXT_UPDATES) {
    await db.query(`update challenges set sections = jsonb_set(sections, $2::text[], to_jsonb(replace(sections->>$3, $4, $5)))
      where code = $1 and position($4 in coalesce(sections->>$3, '')) > 0`, [code, [key], key, from, to]);
  }
}

// Super Admin accounts from Vercel settings (never stored in the code):
//   ADMIN_SETUP_PASSWORD (8+ characters) · ADMIN_SETUP_USERS (default "angel,philips")
// Applied on the first start and again whenever the setting changes (the database keeps only a fingerprint),
// so editing it in Vercel and redeploying resets these accounts' passwords. Passwords changed in the app stay until then.
export function setupPassword() {
  // Forgive copy-paste: surrounding spaces and quotes are dropped.
  return String(process.env.ADMIN_SETUP_PASSWORD || '').trim().replace(/^(["'])(.*)\1$/, '$2').trim();
}
export const setupUsers = () => (process.env.ADMIN_SETUP_USERS || 'angel,philips').split(',').map((u) => u.trim().toLowerCase()).filter(Boolean);

async function bootstrapAdmins(db) {
  const pw = setupPassword();
  if (pw.length < 8) return;
  const users = setupUsers();
  const mark = createHmac('sha256', await sessionSecret(db)).update(`${users.join(',')}\n${pw}`).digest('base64url');
  const { rows } = await db.query(`select value from app_meta where key = 'admin_setup'`);
  if (rows[0]?.value === mark) return;
  for (const u of users) {
    const name = u.charAt(0).toUpperCase() + u.slice(1);
    await db.query(
      `insert into profiles (username, full_name, role_id, is_committee, password_hash, email)
       values ($1, $2, 'super_admin', true, $3, $4)
       on conflict (username) do update set role_id = 'super_admin', active = true, password_hash = excluded.password_hash, session_epoch = now()`,
      [u, name, await hashPassword(pw), `${u}@users.flourish.local`]);
  }
  await db.query(`insert into app_meta values ('admin_setup', $1) on conflict (key) do update set value = excluded.value`, [mark]);
}

// Database schema + first-run seed. Runs on every cold start; everything is idempotent.
// Access rules live in the API (server/rpc.js), not in the database.
import { PERMISSIONS, ROLES, DEFAULT_GRANTS } from '../src/lib/permissions.js';
import { PLAYBOOK } from '../src/lib/playbook.js';
import { PALETTE } from '../src/lib/roster.js';
import { RIDDLES } from '../src/data.js';
import { hashPassword } from './auth.js';

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

export async function migrate(db) {
  await db.exec(SCHEMA);
  const { rows } = await db.query(`select value from app_meta where key = 'seeded'`);
  if (!rows.length) await db.tx((t) => seed(t));
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

// First Super Admins: only while none exists, from Vercel settings (never stored in the code).
//   ADMIN_SETUP_PASSWORD (required, 8+ characters) · ADMIN_SETUP_USERS (default "angel,philips")
async function bootstrapAdmins(db) {
  const pw = process.env.ADMIN_SETUP_PASSWORD;
  if (!pw || pw.length < 8) return;
  const { rows } = await db.query(`select 1 from profiles where role_id = 'super_admin' and active limit 1`);
  if (rows.length) return;
  const users = (process.env.ADMIN_SETUP_USERS || 'angel,philips').split(',').map((u) => u.trim().toLowerCase()).filter(Boolean);
  for (const u of users) {
    const name = u.charAt(0).toUpperCase() + u.slice(1);
    await db.query(
      `insert into profiles (username, full_name, role_id, is_committee, password_hash, email)
       values ($1, $2, 'super_admin', true, $3, $4)
       on conflict (username) do update set role_id = 'super_admin', active = true, password_hash = excluded.password_hash, session_epoch = now()`,
      [u, name, await hashPassword(pw), `${u}@users.flourish.local`]);
  }
}

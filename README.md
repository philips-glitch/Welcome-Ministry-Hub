# Flourish Hub

Admin dashboard + member Game Portal for Welcome Ministry's WM 2026 outing game (#flourishdeeperWM2026), built in React + Vite from the Claude Design files in [`design/`](design/).

## Run

```bash
npm install
npm run dev
```

Without Supabase keys the app runs in **demo mode**: the login page shows sample accounts (Super Admin, Challenge PIC, Captain, Group Leader, Member), every demo account uses password `demo1234`, and data lives in your browser's localStorage.

## Supabase setup (real login)

1. Create a Supabase project.
2. In the SQL editor, run the migrations in order:
   - [`0001_auth_roles.sql`](supabase/migrations/0001_auth_roles.sql): `profiles`, `roles`, `permissions`, `role_permissions`, the new-user trigger, RLS and default grants.
   - [`0002_game.sql`](supabase/migrations/0002_game.sql): game data (see **Database** below), the `submission-media` storage bucket, and seed data (10 groups, R1–R6 + 3 side quests, R1's 10 riddles).
   - [`0003_notifications.sql`](supabase/migrations/0003_notifications.sql): notifications + read receipts, their triggers, and a `pg_cron` job for deadline reminders. If it fails on `pg_cron`, enable the extension under **Database → Extensions** and run it again.
   - [`0004_groups_crud.sql`](supabase/migrations/0004_groups_crud.sql): editable groups. It lifts the fixed 01–10 numbering, adds per-group min/max size, and points `profiles.group_no` at `groups` (renumber cascades; delete un-assigns members). A group with submissions can't be deleted.
3. Deploy the Edge Function that creates accounts and resets passwords. It needs the service role key, which must never be in the browser:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase functions deploy admin-users
   ```
   `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to the function automatically.
4. **Authentication → Providers → Email:** keep Email enabled and turn **off** "Allow new users to sign up", since only admins create accounts. Admin-created accounts are confirmed automatically.
5. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings → API). On Vercel, add the same two under Settings → Environment Variables.
6. Create your own account in the Supabase dashboard (Authentication → Users → Add user, with a password), then make yourself Super Admin in the SQL editor:
   ```sql
   update public.profiles set role_id = 'super_admin' where email = 'you@example.com';
   ```
7. Register everyone else from **Groups → + Tambah member** (straight into a group) or **Members → + Daftarkan member**, and give each person their email and starting password.

## Database

| Table | What it holds | Who can read / write (RLS) |
| --- | --- | --- |
| `profiles` | Accounts: name, role, group, service team, TL, panitia, active | Own row, own group-mates, `members.view` · edits need `members.manage` |
| `roles`, `permissions`, `role_permissions` | Role → permission grants | Everyone reads · `roles.manage` edits (Super Admin locked) |
| `groups` | The 10 groups + Lock & Publish state | Everyone reads · `groups.manage` locks |
| `challenges` | Code, kind (main / side), round, PIC, status, schedule, content sections, scoring rules (JSON), riddles per group, draw seed / lock | Non-draft for everyone · `challenges.manage` for drafts and edits |
| `riddles` | Riddle prompts per challenge | Staff see all · members only their group's drawn riddles, once the challenge is Live |
| `riddle_answers` | Answer key, separate table | Only `challenges.manage` / `submissions.validate` (never sent to members) |
| `riddle_draws` | Which riddles each group got (slot 1..N) | Staff · members see their own group's draw once Live |
| `submissions` | Photo (storage path), IG link, tagged members, No-AI declaration, version; review: checks, location, headcount, score, override note, reject reason | Own group + validators/scorers · insert needs `portal.submit` · review needs `submissions.validate` |
| `group_scores()` | Function: validated points per group per challenge | Everyone (leaderboard) without exposing other groups' submissions |

Database rules (triggers) enforce the game flow:
- A submission is accepted only while its challenge is **Live**, before the deadline, and only for the submitter's own group. The version number counts up automatically.
- Reviewers can only change the review fields.
- Photos go to the private `submission-media/<group>/…` bucket, readable by group-mates and validators.

## Notifications (portal)

The bell in the portal header shows the unread count and opens **Notifikasi**. That page groups notifications by day, has an *Semua / Belum dibaca* filter and *Tandai semua dibaca*, and tapping a notification opens its challenge. The list refreshes every minute and when the tab regains focus. All notifications are created automatically by the database:

| Event | Who gets it | Source |
| --- | --- | --- |
| Submission approved (with points), rejected or asked to resubmit (with reason) | The submitting group | Trigger on `submissions` |
| Challenge set to **Scheduled** (announced) or **Live** (opened) | Everyone | Trigger on `challenges` |
| Deadline in 24 h, and again in 3 h | Each group that still has riddles (or the submission) unsent | `send_deadline_reminders()` via `pg_cron` every 10 min |

Tables: `notifications` (`group_no` null = everyone; `dedupe_key` stops repeats) and `notification_reads` (per user). Members can read only their own audience and mark their own reads. Clients can't create notifications. In demo mode the same rules run in the browser on the demo clock.

## Challenges (admin)

**Challenges** lists every round and side quest.
- **+ Baru** creates a draft.
- For each challenge you can edit: code, kind, round, PIC, name, the 8 content sections (Game Idea … Duration) and the schedule (announce / open / deadline / validation, in WIB).
- **Status:** Draft → Scheduled → Live → Closed → Results Published. Drafts are hidden from members. Scheduled and Live need a deadline, and Live needs the riddle draw first.
- **Scoring rules:**
  - *Riddle foto:* location weight + participation weight (must total 100%), with editable headcount tiers.
  - *Poin tetap:* every validated submission gets the max points.
  - *Nilai manual:* the validator enters 0–max.
- **Riddle bank & draw:** add, edit and delete riddles with answers, set N riddles per group, draw with a random seed (saved immediately), then **Kunci undian** to lock it.
- **Delete** removes the challenge with its riddles, draw and submissions, after a confirmation.

The Validation Queue scores each submission with its challenge's own rules. The Scoring page and the portal leaderboard get one column per main round plus one Side Quest column, all from `group_scores()`.

## Login & roles

One login page (`#/login`) for admins and members: **email + password only**. There is no public sign-up, Google or magic link. Forgotten passwords are reset by an admin (edit the member → Reset password). After sign-in, people with **Buka Admin Dashboard** go to the admin; everyone else goes to the portal.

| Role | Default access |
| --- | --- |
| Super Admin | Everything. Locked, so the event can't be locked out |
| Challenge PIC | Admin: Overview, Challenges, Validation Queue, Scoring, view Members · Portal |
| Captain | Admin: Overview, Validation Queue, Scoring, view Members · Portal |
| Group Leader | Portal, including Submit |
| Member | Portal (read-only; can't submit) |

Edit the grants in **Roles & Access**; changes apply immediately. The database enforces them too (RLS + a trigger): only `members.manage` can change role/group/status, nobody can change their own role, and granting or revoking Super Admin needs `roles.manage`. The `admin-users` Edge Function checks `members.manage` before creating accounts or resetting passwords.

## Admin screens

| Nav | Permission | Notes |
| --- | --- | --- |
| Overview | `dashboard.view` | Focus challenge (first Live main round) countdown, submissions received / pending, SLA, per-group riddle status from the database. The timeline, overdue list and scheduled announcements are still static sample content |
| Groups | `groups.manage` (+ `members.manage` to edit members) | **+ Grup baru** / ✎ on a card: create or edit a group (number, name, colour, min/max size, captains); delete an empty group (members move to "Belum ada grup"; blocked once it has submissions). Real member list. **+ Tambah member** registers a new account straight into that group; click a name to edit (name, team, TL, role / Group Leader, group, active, reset password); drag names between groups or to "Belum ada grup"; seeded Auto-assign with confirmation (optionally re-picks 1 Group Leader per group); live rule checks; Lock & Publish |
| Challenges | `challenges.manage` | Create / edit / delete challenges, status workflow, schedule, scoring rules, riddle bank + draw (see **Challenges** above) |
| Validation Queue | `submissions.validate` | Real submissions per challenge, filter by group / status. `A` approve · `R` reject · `←`/`→` move. Photo, IG link, tagged members, riddle + answer key, checklist, headcount → score by the challenge's rules, override (with reason), reject / resubmit reasons |
| Scoring & Leaderboard | `scores.view` | Standings from validated submissions, one column per main round + Side Quest, rank by any column, ties share a rank |
| Members | `members.view` / `members.manage` | Search/filter, change role/group inline, activate/deactivate, register members, Edit dialog (incl. password reset) |
| Roles & Access | `roles.manage` | Role × permission matrix |

## User Game Portal (`#/portal/home`)

Responsive web version of `design/Flourish Hub Portal.dc.html` (the design was a 390 px phone mockup).

| Width | Layout |
| --- | --- |
| < 640 px | Single column, bottom tab bar (same as the mockup) |
| 640–959 px | Wider gutters, 2-column card grids, bottom tab bar |
| ≥ 960 px | Left sidebar nav, main column + sticky side column |

| Screen | Notes |
| --- | --- |
| Home | Focus challenge countdown + "x dari N riddle terkirim", its schedule, other challenges, your group's rank |
| Challenge Detail | Tabs for every non-draft challenge; your group's drawn riddles with live status (validated / submitted / rejected + reason), scoring rules, submit per riddle (Group Leader, while Live) |
| Submit | Needs `portal.submit`. Pick riddle, photo upload (Supabase Storage), IG Story link, tag group-mates → participation tier, rules + No-AI declaration gate the button. Rejected riddles can be re-sent (new version) |
| Leaderboard | Same standings as admin; tabs per opened challenge, podium, your-group breakdown |
| Me | Profile, link to admin (if allowed), sign out |
| My Group | Placeholder (not in the design yet) |

## What's real vs sample

- **In the database:** accounts, profiles, roles and permissions, groups and their lock, challenges, riddles and answers, draws, submissions and reviews, and scores.
- **Demo mode** keeps the same tables in the browser's localStorage, seeded with the WM 2026 sample, on a demo clock (Jum, 16 Okt 2026 · 19:12 WIB). Photos aren't stored in demo mode. With Supabase configured, the app uses real time.
- **Still static:** the Overview timeline, the overdue-SLA list and the scheduled-announcements card.
- Admin is built for desktop (minimum width 1280 px); the Portal and login page are responsive.
- `design/` holds the original Claude Design sources for reference; they aren't used by the build.

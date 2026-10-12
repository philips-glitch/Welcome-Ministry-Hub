# Flourish Hub

Admin dashboard + member Game Portal for Welcome Ministry's WM 2026 outing game (#flourishdeeperWM2026), built in React + Vite from the Claude Design files in [`design/`](design/).

## Run

```bash
npm install
npm run dev          # demo mode: sample data in the browser, password demo1234 (e.g. angel, nadia.p)
npm run dev:server   # real API + in-memory Postgres (PGlite) on http://localhost:3602 — angel / philips, password demo1234
npm run test:server  # backend checks against PGlite
```

In plain `npm run dev` the login page also shows one-click sample accounts; the deployed site hides them unless `VITE_DEMO_LOGIN=true` is set.

## How it runs on Vercel

- **Front end:** the Vite app (static files).
- **API:** Vercel Functions in [`api/`](api/) → [`server/`](server/): `POST /api/rpc` (all data, one JSON method per call) and `GET /api/media?path=…` (submission photos). Every method checks the caller's permissions (role → `role_permissions`).
- **Database:** any Postgres connected to the Vercel project: `DATABASE_URL` (e.g. Neon) or `POSTGRES_URL` (e.g. the database Vercel's Supabase integration creates, used as plain Postgres). Every table has row-level security switched on with no policies and no rights for Supabase's `anon`/`authenticated` roles, so only this server can read or write it. Tables are created and seeded automatically on first use ([`server/schema.js`](server/schema.js)): roles and permissions, 10 groups, the playbook challenges and the R2 riddle bank.
- **Login:** username + password. Passwords are hashed (scrypt); a signed, HttpOnly session cookie lasts 30 days. Changing a password signs that person out everywhere. 10 wrong passwords in 10 minutes block that username for a while.
- **Photos:** stored in the database (shrunk to ~0.5 MB in the browser before upload), served only to the submitting group and validators.

The app switches to server mode at build time when `DATABASE_URL` or `POSTGRES_URL` is present; without it the build runs on demo data.

## Setup on Vercel

1. **Database:** a Postgres database connected to the project. Currently the one from Vercel's Supabase integration (`POSTGRES_URL`). To move to Neon later: Vercel → **Storage** → **Create Database** → **Neon** (Singapore) and connect it (this adds `DATABASE_URL`, which takes priority); disconnect the Supabase integration first, since its `POSTGRES_*` variables clash with Neon's.
2. **First Super Admins:** Settings → Environment Variables → add `ADMIN_SETUP_PASSWORD` (8+ characters, Production + Preview). On first use the server creates **`angel`** and **`philips`** as Super Admins with that password (`ADMIN_SETUP_USERS` changes the names). It's only used while no Super Admin exists; afterwards passwords are changed in the app (Members → Edit → Reset password).
3. **Redeploy** (push to `main`, or Deployments → Redeploy). Environment variables are read at build time.
4. Log in as `angel` → **Members → Import Excel** (roster) → pick Group Leaders in **Groups** → **Members → Buat password** (new passwords, or "Pakai dari file Excel" for an existing login list).

## Database

| Table | What it holds | Who can read / write (checked in `server/rpc.js`) |
| --- | --- | --- |
| `profiles` | Accounts: username, password hash, name, role, group, original team, position, ministry status, TL, panitia, active | Own row + own group-mates; everyone with `members.view` · membership fields need `members.manage` · Super Admin changes need `roles.manage` · no one changes their own role |
| `roles`, `permissions`, `role_permissions` | Role → permission grants | Everyone reads · `roles.manage` edits (Super Admin locked) |
| `groups` | Groups, size limits, Lock & Publish state | Everyone reads · `groups.manage` writes |
| `challenges` | Code, kind, round, PIC, status, schedule, content sections, scoring rules, submit form, riddles per group, draw seed / lock | Non-draft for everyone · `challenges.manage` for drafts and edits |
| `riddles` | Prompts **and answers** per challenge | Staff see all · members only their group's drawn riddles once Live, never the answer |
| `riddle_draws` | Which riddles each group got | Staff · members their own group's draw once Live |
| `submissions` | Photo path, link, tags, declaration, version; connect: person + answers; review: checks, marks, headcount, score, notes | Own group (connect: only one's own entries) + validators/scorers · rules: Live and before the deadline, own group, connect = any player about a group-mate (once each, max N), others = `portal.submit` · review needs `submissions.validate` |
| `media` | Submission photos (bytes) | The submitting group and validators |
| `profile_gtkm` | Get to Know Me answers from the Member Form, the key for R1 Q1–Q3 | `submissions.validate` / `members.manage` read · `members.manage` writes · never members |
| `notifications`, `notification_reads` | Automatic notifications + who read them | Each user: everyone's + their group's |
| `login_attempts`, `app_meta` | Login rate limiting; seed marker and the session-signing secret | Server only |

Scores are computed on request from validated submissions with the same rules as demo mode (`groupPoints` in [`src/lib/game.js`](src/lib/game.js)).

## Notifications (portal)

The bell in the portal header shows the unread count and opens **Notifikasi** (grouped by day, *Semua / Belum dibaca*, *Tandai semua dibaca*; tapping one opens its challenge). The list refreshes every minute and when the tab regains focus. Notifications are created by the server:

| Event | Who gets it |
| --- | --- |
| Submission approved (with points), rejected or asked to resubmit (with reason) | The submitting group |
| Challenge set to **Scheduled** (announced) or **Live** (opened) | Everyone |
| Deadline in 24 h, and again in 3 h | Each group that still has work left (riddles unsent, or members who haven't sent their people) — created when someone opens their notifications |

`dedupe_key` stops repeats. In demo mode the same rules run in the browser on the demo clock.

## Roster import

**Members → Import Excel** (Super Admin) replaces the whole roster from a spreadsheet: one row per member with an **Assigned Group** and a **Name** column; **Team** (original team), **Role** (ministry status: "Team Leader" becomes Ministry TL) and **Positions** are used when present. Other columns (phone, gender, …) are ignored. The file is read in the browser only and never stored in the repo.

1. Pick the .xlsx (or .csv). The preview shows each group with its member, Team Leader and inactive counts.
2. Paste the Team Captains, one per line in group order (line 1 → the first group), and the Challenge PICs. Challenges whose PIC has the same first name are linked to the new account.
3. Confirm. Everything from the old roster is deleted first: every account except Super Admins, all groups not in the file, all submissions (with photos), notifications, riddle draws and Get to Know Me answers. Challenges and riddle banks stay.
4. Accounts get short usernames (first name, else first.last) and random 8-character passwords; **download the login list (Excel)** on the result screen, the only place they're shown. In demo mode every account uses `demo1234`.
5. Pick one Group Leader per group in **Groups**.

**Members → Buat password** sets new 8-character passwords for every active Captain / Group Leader / Challenge PIC (and downloads the Excel list), or applies the Username/Password pairs from an existing login list ("Pakai dari file Excel").

## Mini Events (Playbook - Welcome UR Outing 2026)

| Code | Mini Event | Dates (WIB) | Who submits | Scoring |
| --- | --- | --- | --- | --- |
| R1 | Get to Know Me | 12–18 Oct, deadline 23:59 | Every player, about 2 group-mates | Q1–Q3 0/1/2, Q4 0/2/4, photo +2 → max 12 per person, 24 per member. Team = avg ÷ 24 × 70 + participation rate × 30 (max 100) |
| R2 | Guess, Find, Snap! | 21–25 Oct, deadline 23:59 | Group Leader, per clue (4 random) | Correct photo 10 / wrong 0, + team participation 10/6/2 (≥10 / ≥7 / fewer people tagged) → max 50 |
| R3 | Give and Grow | 28 Oct–1 Nov, deadline 23:59 | Group Leader, one video link | Rubric 20 + 15 + 10 + 5, + team participation 50/35/20 → max 100 |
| R4 | Spice It Up | — | — | Unchanged draft (cancelled in the playbook) |
| R5 | Ingatlah hari ini | opens 10 Nov, deadline 15 Nov 23:59 | Group Leader, scrapbook photo | Rules and scoring "to be announced" |

The texts (purpose, how to play, rules, scoring) live in [`src/lib/playbook.js`](src/lib/playbook.js), which seeds both demo mode and the database; they're editable afterwards in **Challenges**. The R2 riddle bank is still the sample set from the design: replace it with the real clues before the draw.

## Challenges (admin)

**Challenges** lists every round and side quest.
- **+ Baru** creates a draft.
- For each challenge you can edit: code, kind, round, PIC, name, the 8 content sections (Game Idea … Duration) and the schedule (announce / open / deadline / validation, in WIB).
- **Status:** Draft → Scheduled → Live → Closed → Results Published. Drafts are hidden from members. Scheduled and Live need a deadline, and Live needs the riddle draw first.
- **Scoring rules:**
  - *Riddle foto:* location weight + participation weight (must total 100%), with editable headcount tiers.
  - *Rubrik + partisipasi tim:* criteria per submission (yes/no or 0–max), plus one team participation tier from everyone tagged in the group's validated submissions.
  - *Kenalan (individu):* every player submits for themselves about N group-mates; questions scored 0 / half / full against the person's Member Form answers (set in the member dialog), optional photo bonus; team score = average member score × individual weight + participation rate × participation weight.
  - *Poin tetap:* every validated submission gets the max points.
  - *Nilai manual:* the validator enters 0–max.
  - *Skor belum diumumkan* hides the scoring from members ("menyusul").
- **Form submit & validasi:** photo and link required / optional / none, link label, typed answer, member tags, the rules members tick, the validator checklist and reject reasons.
- **Riddle bank & draw:** add, edit and delete riddles with answers, set N riddles per group, draw with a random seed (saved immediately), then **Kunci undian** to lock it.
- **Delete** removes the challenge with its riddles, draw and submissions, after a confirmation.

The Validation Queue scores each submission with its challenge's own rules. The Scoring page and the portal leaderboard get one column per main round plus one Side Quest column, all from `group_scores()`.

## Login & roles

One login page (`#/login`) for admins and members: **username + password only**. A real email is optional contact info. There is no public sign-up, Google or magic link. Forgotten passwords are reset by an admin (edit the member → Reset password). After sign-in, people with **Buka Admin Dashboard** go to the admin; everyone else goes to the portal.

| Role | Default access |
| --- | --- |
| Super Admin | Everything. Locked, so the event can't be locked out |
| Challenge PIC | Admin: Overview, Challenges, Validation Queue, Scoring, view Members · Portal |
| Captain | Admin: Overview, Validation Queue, Scoring, view Members · Portal |
| Group Leader | Portal, including Submit |
| Member | Portal; submits only their own entries in per-member challenges (R1 Get to Know Me) |

Edit the grants in **Roles & Access**; changes apply immediately. The server enforces them on every request: only `members.manage` can change role/group/status or create accounts and reset passwords, nobody can change their own role, and granting or revoking Super Admin (or changing a Super Admin's account) needs `roles.manage`.

## Admin screens

| Nav | Permission | Notes |
| --- | --- | --- |
| Overview | `dashboard.view` | Focus challenge (first Live main round) countdown, submissions received / pending, SLA, per-group riddle status from the database. The timeline, overdue list and scheduled announcements are still static sample content |
| Groups | `groups.manage` (+ `members.manage` to edit members) | **+ Grup baru** / ✎ on a card: create or edit a group (number, name, colour, min/max size, captains); delete an empty group (members move to "Belum ada grup"; blocked once it has submissions). Real member list. **+ Tambah member** registers a new account straight into that group; click a name to edit (name, team, TL, role / Group Leader, group, active, reset password); drag names between groups or to "Belum ada grup"; seeded Auto-assign with confirmation (optionally re-picks 1 Group Leader per group); live rule checks; Lock & Publish |
| Challenges | `challenges.manage` | Create / edit / delete challenges, status workflow, schedule, scoring rules, riddle bank + draw (see **Challenges** above) |
| Validation Queue | `submissions.validate` | Real submissions per challenge, filter by group / status. `A` approve · `R` reject · `←`/`→` move. Photo, IG link, tagged members, riddle + answer key, checklist, headcount → score by the challenge's rules, override (with reason), reject / resubmit reasons |
| Scoring & Leaderboard | `scores.view` | Standings from validated submissions, one column per main round + Side Quest, rank by any column, ties share a rank |
| Members | `members.view` / `members.manage` | Search by name / username / IG, change role/group inline, activate/deactivate, register members (username suggested from the name), Edit dialog (change username, reset password, contact email) |
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
| Submit | Needs `portal.submit`. Pick riddle, photo upload (stored in the database), IG Story link, tag group-mates → participation tier, rules + No-AI declaration gate the button. Rejected riddles can be re-sent (new version) |
| Leaderboard | Same standings as admin; tabs per opened challenge, podium, your-group breakdown |
| Me | Profile, link to admin (if allowed), sign out |
| My Group | Placeholder (not in the design yet) |

## What's real vs sample

- **In the database:** accounts, profiles, roles and permissions, groups and their lock, challenges, riddles and answers, draws, submissions and reviews, and scores.
- **Demo mode** keeps the same tables in the browser's localStorage and the submission photos in IndexedDB, seeded with the WM 2026 sample, on a demo clock (Jum, 16 Okt 2026 · 19:12 WIB). Seeded submissions have no photo. On Vercel with a database, the app uses real time and photos are stored in the database.
- **Photos** are shrunk in the browser before upload (longest side 1,600 px, JPEG; a 5–6 MB phone photo becomes about 0.5 MB). They show in the admin Validation Queue (click to zoom) and as thumbnails on the group's riddle cards in the portal.
- **Still static:** the Overview timeline, the overdue-SLA list and the scheduled-announcements card.
- Admin is built for desktop (minimum width 1280 px); the Portal and login page are responsive.
- `design/` holds the original Claude Design sources for reference; they aren't used by the build.

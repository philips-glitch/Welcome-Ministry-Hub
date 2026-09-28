# Flourish Hub

Admin dashboard + member Game Portal for Welcome Ministry's WM 2026 outing game (#flourishdeeperWM2026), built in React + Vite from the Claude Design files in [`design/`](design/).

## Run

```bash
npm install
npm run dev
```

Without Supabase keys the app runs in **demo mode**: the login page shows sample accounts (Super Admin, Challenge PIC, Captain, Group Leader, Member) and data lives in your browser's localStorage.

## Supabase setup (real login)

1. Create a Supabase project.
2. In the SQL editor, run [`supabase/migrations/0001_auth_roles.sql`](supabase/migrations/0001_auth_roles.sql). It creates `profiles`, `roles`, `permissions`, `role_permissions`, the new-user trigger, RLS policies and the default role grants.
3. **Authentication → URL Configuration:** set Site URL to your app URL and add it (plus `http://localhost:5173`) to Redirect URLs.
4. **Authentication → Providers:** Email is on by default (magic link + password). To use "Masuk dengan Google", enable Google and add your Google OAuth client ID/secret.
5. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
6. Sign in once, then make yourself Super Admin in the SQL editor:
   ```sql
   update public.profiles set role_id = 'super_admin' where email = 'you@example.com';
   ```
7. Invite everyone else from **Members → Undang member**. The login form never self-registers new accounts: people must be invited first.

Supabase's built-in email service is rate-limited (a few emails per hour). Set up custom SMTP before inviting 140+ people.

## Login & roles

One login page (`#/login`) for admins and members: Google, magic link, or email + password. After sign-in, people with **Buka Admin Dashboard** go to the admin; everyone else goes to the portal.

| Role | Default access |
| --- | --- |
| Super Admin | Everything. Locked, so the event can't be locked out |
| Challenge PIC | Admin: Overview, Challenges, Validation Queue, Scoring, view Members · Portal |
| Captain | Admin: Overview, Validation Queue, Scoring, view Members · Portal |
| Group Leader | Portal, including Submit |
| Member | Portal (read-only; can't submit) |

Edit the grants in **Roles & Access**; changes apply immediately. The database enforces them too (RLS + a trigger): only `members.manage` can change role/group/status, nobody can change their own role, and granting or revoking Super Admin needs `roles.manage`.

## Admin screens

| Nav | Permission | Notes |
| --- | --- | --- |
| Overview | `dashboard.view` | Live R1 countdown, stat cards, timeline, submissions per group, overdue SLA, scheduled announcements |
| Groups | `groups.manage` | Drag members between groups, live rule checks, seeded Auto-assign, Lock & Publish |
| Challenges | `challenges.manage` | R1 Photo builder: status, template fields, schedule, score formula, riddle bank + seeded draw |
| Validation Queue | `submissions.validate` | `A` approve · `R` reject · `→` skip; checklist, headcount → score, override note, reject reasons |
| Scoring & Leaderboard | `scores.view` | Standings for all groups, points per challenge (R1–R6, Side Quest), filter/rank by challenge, ties share a rank. Updates live from queue approvals |
| Members | `members.view` / `members.manage` | Search/filter, change role/group, activate/deactivate, invite by email (magic link) |
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
| Home | Live countdown, active challenges, this week, your group's rank |
| Challenge Detail | Riddles for your group, do's & don'ts, scoring, submit button (Group Leader only) |
| Submit | Needs `portal.submit`. Upload progress, IG proof, member tagging → participation tier, rules + No-AI declaration gate the submit button |
| Leaderboard | Same standings as admin; tabs, podium, your-group breakdown |
| Me | Profile, link to admin (if allowed), sign out |
| My Group | Placeholder (not in the design yet) |

## What's real vs sample

- **In Supabase:** accounts, sessions, member profiles, roles and permissions.
- **Still sample data** (`src/data.js`): groups, challenges, riddles, submissions and scores, plus the demo clock (Jum, 16 Okt 2026 · 19:12 WIB). Group assignments and queue decisions reset on reload. Group Forming uses the 137 sample members, not the Supabase `profiles` table.
- Admin is built for desktop (minimum width 1280 px); the Portal and login page are responsive.
- `design/` holds the original Claude Design sources for reference; they aren't used by the build.

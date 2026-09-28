# Flourish Hub — Admin Dashboard

Admin dashboard for Welcome Ministry's WM 2026 outing game (#flourishdeeperWM2026), built in React + Vite from the Claude Design file in [`design/`](design/).

## Run

```bash
npm install
npm run dev
```

## Screens

| Nav | Status | Notes |
| --- | --- | --- |
| Overview | ✅ | Live R1 countdown, stat cards, timeline (8 Okt – 19 Nov), submissions per group, overdue SLA, scheduled announcements |
| Groups | ✅ | Group Forming: drag members between groups, live rule checks, Auto-assign (seeded), Lock & Publish once all rules pass |
| Challenges | ✅ | Challenge Builder for R1 Photo: status segment, editable template fields, schedule, score formula, riddle bank + seeded draw with lock |
| Validation Queue | ✅ | Keyboard `A` approve · `R` reject · `→` skip; checklist, participant count → auto score, override note, reject reasons |
| Scoring & Leaderboard, IG Ops, Members, Audit Log | ⏳ | Not in the design yet; placeholder pages |

## User Game Portal (`#/portal/home`)

Responsive web version of `design/Flourish Hub Portal.dc.html` (the design was a 390 px phone mockup). Demo user: Nadia, Group Leader of Vine (04).

| Width | Layout |
| --- | --- |
| < 640 px | Single column, bottom tab bar (same as the mockup) |
| 640–959 px | Wider gutters, 2-column card grids, bottom tab bar |
| ≥ 960 px | Left sidebar nav, main column + sticky side column |

| Screen | Status | Notes |
| --- | --- | --- |
| Home | ✅ | Live countdown, active challenges, this week, rank card |
| Challenge Detail | ✅ | Riddles for your group, do's & don'ts, scoring, submit CTA |
| Submit | ✅ | Upload progress (pause/retry), IG proof, member tagging → participation tier, rules + No-AI declaration gate the submit button |
| Leaderboard | ✅ | Tabs, podium, your-group breakdown |
| My Group, Me | ⏳ | Not in the design yet; placeholders |

## Notes

- Everything runs on **sample data** and a **demo clock** (Jum, 16 Okt 2026 · 19:12 WIB); there is no backend yet. See `src/data.js`.
- State is in memory: group assignments and queue decisions reset on reload.
- Built for desktop (design target 1440 px); minimum width 1280 px.
- `design/` holds the original Claude Design sources (Admin + User Portal) for reference. They aren't used by the build.

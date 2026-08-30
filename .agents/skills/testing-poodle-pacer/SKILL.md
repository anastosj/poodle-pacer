---
name: testing-poodle-pacer
description: How to run and browser-test the Poodle Pacer Next.js app locally (dev server under Node 22, demo login via seeded pp_session cookie, fresh un-onboarded user for the onboarding wizard, and how the calendar/program grid is laid out).
---

# Testing Poodle Pacer end-to-end in the browser

## Running the app
- `npm run dev` serves http://localhost:3000. Keep the SQLite default; never point at `DATABASE_URL`/Neon.
- The default shell Node may be v20 while `better-sqlite3` in the snapshot is built for Node 22.
  If you see `NODE_MODULE_VERSION 127 ... requires 115`, prefix commands with:
  `export PATH=$HOME/.nvm/versions/node/v22.12.0/bin:$PATH` (or run `npm rebuild better-sqlite3`).
  This applies to any ad-hoc `node` script that opens `data/poodle-pacer.db`, not just the dev server.
- `data/poodle-pacer.db` is created lazily: start the dev server and load a page once before seeding.

## Logging in (Strava OAuth is impractical)
- `npm run seed:demo` seeds demo runners and prints a `document.cookie = "pp_session=..."` line.
  Set that cookie for `localhost` (any port — cookies ignore port, so a second dev server on
  :3001 shares the session) and reload.
- Expected, not failures: `/api/strava/*` → 401 `not_connected`; `/api/map` → 503 without `MAPBOX_TOKEN`.

## Getting an un-onboarded user (to test the onboarding wizard)
The seeded demo users already have plans, so the wizard never opens. Create a throwaway user with a
small script **inside the repo** (so `better-sqlite3` resolves) that inserts into `users` +
`user_state` and signs a cookie with `HMAC-SHA256(base64url(JSON payload), AUTH_SECRET)` in the form
`<body>.<sig>` with payload `{uid, iat, exp}` (see `scripts/seed-demo.mjs`). Delete the helper when done.

## Reading the training grid
- Program day index is Monday-first (0 = Mon … 6 = Sun), but the calendar renders **Sunday→Saturday**
  columns, so one program week straddles two calendar rows ("Program wk N & N+1"). Expect Sunday long
  runs to appear in the *next* row; do not report this as an off-by-one bug.
- Week view: `aria-label="Previous week"` / `"Next week"` arrows; the next arrow becomes `disabled`
  on the final program week — a good way to assert the program's week count.
- Day cell caret (`aria-label="Mark done or edit"`) → `Mark done` / `Log details` (or `Mark not done` /
  `Edit details` once done). "Log details" shows a distance input (`placeholder="Running miles"`) for any
  `run`-type workout, including workouts with **no** prescribed `miles` (speed/hill/interval days).
- Clicking the logged summary chip opens the workout detail modal (distance, time, avg pace).
- Seeded demo activities cover the recent past, so past speed days may already be "Done"; pick a
  *future* unlogged day when you need to exercise manual logging.

## Progress page checks
- `/progress` "Weekly running miles" chart has one bar per program week and an accessible text summary
  listing "Week N: X miles run of Y planned" — the fastest way to assert planned-mileage totals for
  every week without hovering. Workouts without `miles` contribute 0 planned miles by design.

## Server-log evidence
The dev server's stdout lives in the shell that started it. If you cannot read it back, start a second
instance with output redirected (`npx next dev -p 3001 > /tmp/dev3001.log 2>&1 &`), reload the routes
under test in the browser (cookie carries over), then grep that file.

## Devin Secrets Needed
- none for local browser testing (`AUTH_SECRET` is generated into `.env.local` by the blueprint;
  `STRAVA_CLIENT_ID`/`STRAVA_CLIENT_SECRET`/`MAPBOX_TOKEN` are optional).

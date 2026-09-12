---
name: testing-poodle-pacer
description: How to run and browser-test the Poodle Pacer Next.js app locally — dev server prerequisites, creating an authenticated fresh (non-onboarded) test user, exercising onboarding/plan-date flows, and known UI quirks (native date inputs, month navigation, heatmap visibility).
---

# Testing Poodle Pacer locally

## Dev server
- Next.js 14 app, `npm run dev` on http://localhost:3000.
- `better-sqlite3` in this checkout is built for Node 22. If the server crashes with
  `NODE_MODULE_VERSION ... Please try re-compiling or re-installing the module`, start it under Node 22:
  ```bash
  export PATH=$HOME/.nvm/versions/node/v22.12.0/bin:$PATH
  npm run dev
  ```
  (Alternatively `npm rebuild better-sqlite3` under the Node you intend to use.)
- The local SQLite DB lives at `data/poodle-pacer.db` and is only created after the app has
  served at least one request. `npm run seed:demo` fails with
  "No local database yet. Start the app once (npm run dev)…" until then — start the server, hit a
  page, then reseed.

## Getting an authenticated browser session
- Auth uses a signed `pp_session` cookie (HMAC with `AUTH_SECRET`, see `src/lib/session.ts`);
  `AUTH_SECRET` normally comes from `.env.local`. Unauthenticated navigation redirects to `/login`.
- Seeded demo users are already onboarded, so they cannot exercise the onboarding wizard.
  To test onboarding, insert a new user row into `data/poodle-pacer.db` with **no state row**
  (e.g. id `demo:fresh`) and mint a `pp_session` cookie for it with the app's own
  `serializeSession` helper, then set that cookie in the browser.
- The onboarding wizard only renders when the user is loaded, not onboarded, has no `startDate`,
  and has no logs (`src/components/HomePage.tsx`).

## Plan-date / calendar flows
- Race-date math lives in `src/lib/store.ts` (`startDateFromRace`, `raceDateOf`,
  `planFromRaceDate`), taper reshuffling in `src/lib/programs.ts` (`withRaceDayIndex`), and
  Mon-first calendar logic in `src/lib/dates.ts` / `src/lib/calendar.ts`.
- Compute expected dates yourself with `date -d` before asserting; the environment date may be
  far in the future/past, and countdowns are relative to "today".
- Both date fields on `/goals` ("Race day" and "or training starts") are native `<input type=date>`.
  Typing into them is unreliable — open the picker and click the day cell instead, and re-read the
  DOM value after every change to confirm what actually got set.
- Home calendar: switch to "This month", then click the ▸ arrow **one month per click and wait for
  the re-render**; rapid successive clicks are dropped. Program weeks appear as one row per week only
  when the plan starts on a Monday; a non-Monday start legitimately shows "wk N & N+1" split rows.

## Heatmap
- `TrainingHeatmap` on `/progress` returns `null` until the plan has completed volume in the current
  calendar year. To see it, mark a workout done (day cell chevron → "Mark done") on a date inside the
  current year first.
- Mon-first is verifiable from the row labels: they read `T / T / S` (Tue, Thu, Sat) for Monday-first
  and `M / W / F` for Sunday-first.

## Known quirks (may or may not be bugs)
- `/group` ("The Pack") roster rows read "Hasn't set a race date yet" when the pack's plan id does
  not match the member's own plan id — this appears to be pre-existing plan-id matching, not a crash.
- Goals explanatory copy derives the weekday from the *race date* rather than the stored
  `raceDayIndex`, so setting a non-Monday **training start** can make it claim the taper was shifted
  when no shift was applied.

## Devin Secrets Needed
- `AUTH_SECRET` — required to mint/verify `pp_session` cookies.
- Strava credentials (`STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`) only if testing Strava sync;
  all plan/calendar flows work without them.

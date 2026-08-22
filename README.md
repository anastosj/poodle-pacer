# Poodle Pacer 🐩

A white-poodle-themed (blue headband, naturally) half marathon training tracker and sidekick.

## Features

- **Program selector** — starts with Hal Higdon's Half Marathon Novice 1 (12 weeks); more programs coming soon.
- **Two runners** — switch between Jonathan and Sam, each with their own program, start date, and logs.
- **Training grid** — the full 12-week schedule, mark workouts done, log miles/minutes, today's workout highlighted.
- **Strava sync** — connect each runner's Strava account and auto-log runs into the matching training day.
- **Progress stats** — workouts done, miles logged, current week, and days to race.

## Getting started

```bash
npm install
cp .env.example .env.local   # add Strava credentials to enable syncing
npm run dev
```

Open http://localhost:3000.

## Strava setup

1. Create an API application at https://www.strava.com/settings/api.
2. Set the **Authorization Callback Domain** to your host (e.g. `localhost` for dev).
3. Put the Client ID and Client Secret in `.env.local` as `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`.

The app works fine without Strava — you can log runs manually. Sam can connect her account whenever she makes one.

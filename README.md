# Poodle Pacer 🐩

A white-poodle-themed (blue headband, naturally) running and triathlon training tracker.

## Features

- **Training catalog** — Hal Higdon beginner 10K, half marathon, and marathon plans, plus beginner Sprint, Olympic, and 70.3 triathlon plans adapted from Triathlete.
- **Multiple races** — track separate programs, start dates, and logs.
- **Training grid** — view the full schedule, including runs, cross-training, swims, rides, bricks, and races.
- **Strava sync** — connect Strava and auto-log running activities into the matching training day; other sports can be completed manually.
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

The app works without Strava — workouts can be completed and running details logged manually.

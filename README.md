# Poodle Pacer 🐩

A white-poodle-themed (blue headband, naturally) running and triathlon training tracker.

## Features

- **Training catalog** — Hal Higdon beginner 10K, half marathon, and marathon plans, plus beginner Sprint, Olympic, and 70.3 triathlon plans adapted from Triathlete.
- **Multiple races** — track separate programs, start dates, and logs.
- **Training grid** — view the full schedule, including runs, cross-training, swims, rides, bricks, and races.
- **Move a workout** — drag a day's tile onto another day of the same training week (or use *Move to…* on the tile's menu) to trade the two around. The week keeps its shape and its total load. Race day and anything already completed stay put.
- **Strava sync** — connect Strava and auto-log activities into the matching training day. A session done up to three days off still finds the workout it was meant for, across a week boundary if that is where it falls: miss Monday's run and do it on Tuesday's rest day, or finish Sunday's long run on the Monday, and your consistency and streak carry on. Weights and HIIT classes complete cross-training days, and only running ever counts as mileage.
- **Life happened** — mark a stretch you missed as paused, and it sits out of your consistency and can't break your streak. Race day never moves.
- **Notifications** — browser push each morning there's a workout, plus a race-eve pep talk and a race-day good luck. Texts are available too.
- **Progress stats** — workouts done, miles logged, current week, and days to race, over this week, this month, the last six months, or the plan from its first day to race day.

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

## Notifications

Browser push is the default alert channel: it is free to send and needs no phone
number. Generate a VAPID key pair and put it in `.env.local`:

```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`,
then turn notifications on from Settings. Push requires HTTPS, except on
`localhost`; on iOS the app must be added to the Home Screen first.

SMS stays available for anyone who wants it — see the Twilio variables in
`.env.example`. The scheduler sends on whichever channels are configured.

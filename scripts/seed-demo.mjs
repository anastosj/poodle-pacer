#!/usr/bin/env node
/**
 * Seed (or remove) demo runners so the app can be viewed with realistic data.
 *
 *   node scripts/seed-demo.mjs           # create three demo runners
 *   node scripts/seed-demo.mjs --remove  # delete them again
 *
 * Every account created here has an id prefixed `demo:`, and --remove only ever
 * deletes that prefix, so real Strava accounts (`strava:...`) cannot be touched.
 *
 * Writes to Neon when DATABASE_URL is set, otherwise the local SQLite file.
 */

import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/* ----------------------------- env loading ------------------------------- */

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(process.cwd(), file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, key, raw] = m;
      if (process.env[key]) continue;
      process.env[key] = raw.replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const REMOVE = process.argv.includes("--remove");
const USING_PG = Boolean(process.env.DATABASE_URL);

/* ------------------------------- dates ----------------------------------- */

const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const today = new Date();
today.setHours(0, 0, 0, 0);

/** Monday of the current week, then wound back two weeks. */
const mondayThisWeek = new Date(today);
mondayThisWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));
const startDate = new Date(mondayThisWeek);
startDate.setDate(mondayThisWeek.getDate() - 14);
const START = toISO(startDate);

/** Whole days from the plan start to today, used to stop logging the future. */
const daysElapsed = Math.round((today - startDate) / 86400000);

/* ------------------------- program shape (weeks 1-3) ---------------------- */
// Matches hal-higdon-half-novice-1: index 0 = Monday.
// 0 rest · 1 run · 2 run-or-cross · 3 run · 4 rest · 5 long run · 6 cross
const WEEKS = [
  { week: 1, miles: { 1: 3, 2: 2, 3: 3, 5: 4 } },
  { week: 2, miles: { 1: 3, 2: 2, 3: 3, 5: 4 } },
  { week: 3, miles: { 1: 3.5, 2: 2, 3: 3.5, 5: 5 } },
];

/* ------------------------------ the cast --------------------------------- */

const RUNNERS = [
  {
    id: "demo:aster",
    name: "Aster Demo",
    plan: "Brooklyn Half 2026",
    // Chance of completing any given workout, and seconds per mile.
    consistency: 0.95,
    basePace: 612, // 10:12/mi, improving over the fortnight
    improvement: 26, // seconds per mile gained by week 3
    hr: 152,
    cadence: 172,
  },
  {
    id: "demo:casey",
    name: "Casey Rivera",
    plan: "Brooklyn Half 2026",
    consistency: 0.72,
    basePace: 558, // 9:18/mi
    improvement: 12,
    hr: 146,
    cadence: 176,
  },
  {
    id: "demo:morgan",
    name: "Morgan Lee",
    plan: "Prospect Park Half",
    consistency: 0.45,
    basePace: 675, // 11:15/mi
    improvement: 8,
    hr: 158,
    cadence: 165,
  },
];

const RUN_NAMES = [
  "Morning Run",
  "Lunch Run",
  "Evening Run",
  "Park loop",
  "Bridge and back",
  "Easy shakeout",
  "Negative splits",
  "Long run",
];

/** Deterministic pseudo-random in [0,1), so reseeding gives the same data. */
function rng(seed) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function buildLogs(runner) {
  const rand = rng(runner.id);
  const logs = {};

  for (const { week, miles } of WEEKS) {
    for (const [dayIndexStr, planned] of Object.entries(miles)) {
      const dayIndex = Number(dayIndexStr);
      const dayNumber = (week - 1) * 7 + dayIndex;
      // Never log a workout that has not happened yet.
      if (dayNumber > daysElapsed) continue;
      if (rand() > runner.consistency) continue; // a missed day

      const actual = Math.round((planned + (rand() - 0.5) * 0.5) * 100) / 100;
      const progress = (week - 1) / (WEEKS.length - 1);
      const pace =
        runner.basePace - runner.improvement * progress + (rand() - 0.5) * 34;
      const isLong = dayIndex === 5;

      logs[`${week}-${dayIndex}`] = {
        completed: true,
        miles: actual,
        seconds: Math.round(actual * (isLong ? pace + 22 : pace)),
        feel: rand() < 0.62 ? "good" : rand() < 0.8 ? "medium" : "bad",
        stravaName: isLong
          ? "Long run"
          : RUN_NAMES[Math.floor(rand() * RUN_NAMES.length)],
        avgHeartRate: Math.round(runner.hr + (rand() - 0.5) * 10),
        maxHeartRate: Math.round(runner.hr + 20 + rand() * 8),
        elevationGain: Math.round(40 + rand() * 190),
        cadence: Math.round(runner.cadence + (rand() - 0.5) * 7),
      };
    }

    // Sunday cross-training: an hour in the pool, no distance.
    const crossDay = (week - 1) * 7 + 6;
    if (crossDay <= daysElapsed && rand() < runner.consistency) {
      logs[`${week}-6`] = {
        completed: true,
        miles: 0,
        seconds: 3600,
        feel: "good",
        stravaName: "Pool session",
      };
    }
  }
  return logs;
}

function stateFor(runner) {
  return {
    plans: [
      {
        id: `plan-${runner.id}`,
        name: runner.plan,
        programId: "hal-higdon-half-novice-1",
        startDate: START,
        logs: buildLogs(runner),
      },
    ],
    activePlanId: `plan-${runner.id}`,
    alerts: { phone: "", time: "07:00", enabled: false },
    onboarded: true,
  };
}

/* ------------------------------ persistence ------------------------------ */

async function withPg(fn) {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL, {
    fetchOptions: { cache: "no-store" },
  });
  return fn(sql);
}

async function run() {
  const now = new Date().toISOString();

  if (USING_PG) {
    await withPg(async (sql) => {
      if (REMOVE) {
        await sql`DELETE FROM user_state WHERE user_id LIKE 'demo:%'`;
        await sql`DELETE FROM strava_tokens WHERE user_id LIKE 'demo:%'`;
        await sql`DELETE FROM users WHERE id LIKE 'demo:%'`;
        return;
      }
      for (const r of RUNNERS) {
        await sql`INSERT INTO users (id, strava_athlete_id, name, avatar_url, created_at, last_login_at)
          VALUES (${r.id}, ${r.id}, ${r.name}, ${null}, ${now}, ${now})
          ON CONFLICT(id) DO UPDATE SET name = excluded.name, last_login_at = excluded.last_login_at`;
        const data = JSON.stringify(stateFor(r));
        await sql`INSERT INTO user_state (user_id, data, updated_at)
          VALUES (${r.id}, ${data}, ${now})
          ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`;
      }
    });
  } else {
    const { default: Database } = await import("better-sqlite3");
    const file = path.join(process.cwd(), "data", "poodle-pacer.db");
    if (!fs.existsSync(file)) {
      console.error(
        "No local database yet. Start the app once (npm run dev) so it is created, then rerun."
      );
      process.exit(1);
    }
    const db = new Database(file);
    if (REMOVE) {
      db.prepare("DELETE FROM user_state WHERE user_id LIKE 'demo:%'").run();
      db.prepare("DELETE FROM strava_tokens WHERE user_id LIKE 'demo:%'").run();
      db.prepare("DELETE FROM users WHERE id LIKE 'demo:%'").run();
    } else {
      const upsertUser = db.prepare(
        `INSERT INTO users (id, strava_athlete_id, name, avatar_url, created_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, last_login_at = excluded.last_login_at`
      );
      const upsertState = db.prepare(
        `INSERT INTO user_state (user_id, data, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      );
      for (const r of RUNNERS) {
        upsertUser.run(r.id, r.id, r.name, null, now, now);
        upsertState.run(r.id, JSON.stringify(stateFor(r)), now);
      }
    }
  }

  const where = USING_PG ? "Neon" : "local SQLite";

  if (REMOVE) {
    console.log(`\nRemoved all demo: accounts from ${where}.`);
    console.log("Real Strava accounts were not touched.\n");
    return;
  }

  console.log(`\nSeeded ${RUNNERS.length} demo runners into ${where}.`);
  console.log(`Plan start: ${START} (${daysElapsed} days of history)\n`);
  for (const r of RUNNERS) {
    const logs = stateFor(r).plans[0].logs;
    const done = Object.keys(logs).length;
    const miles =
      Math.round(
        Object.values(logs).reduce((sum, l) => sum + (l.miles ?? 0), 0) * 10
      ) / 10;
    console.log(
      `  ${r.name.padEnd(14)} ${String(done).padStart(2)} workouts · ${String(
        miles
      ).padStart(5)} mi · ${r.plan}`
    );
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    console.log(
      "\nAUTH_SECRET is not set here, so no sign-in cookie was generated."
    );
    return;
  }
  const body = Buffer.from(
    JSON.stringify({
      uid: RUNNERS[0].id,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 86400,
    })
  ).toString("base64url");
  const token = `${body}.${createHmac("sha256", secret)
    .update(body)
    .digest("base64url")}`;

  console.log(`\nTo browse as ${RUNNERS[0].name}, open the app and paste this`);
  console.log("into the browser console, then reload:\n");
  console.log(`  document.cookie = "pp_session=${token}; path=/"\n`);
  console.log("The cookie expires in 7 days.\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

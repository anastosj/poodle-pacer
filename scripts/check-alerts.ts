/**
 * Dry-run checks for the alert rules and achievement/predictor math.
 * Run with: npx tsx scripts/check-alerts.ts
 */
import { dueAlert, localNow } from "../src/lib/alerts";
import { bestStreak, computeAchievements } from "../src/lib/achievements";
import { predictRace } from "../src/lib/predictor";
import { halHigdonHalfNovice1 } from "../src/lib/programs";
import { AlertSettings, Plan, RunnerState } from "../src/lib/store";
import { addDaysISO, toLocalISO, startOfToday } from "../src/lib/dates";

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures += 1;
}

const program = halHigdonHalfNovice1;
const today = toLocalISO(startOfToday());
// Start the plan so that today is week 1 day 1 (a Monday rest day)... instead,
// anchor dates around a fixed start where we control which day "today" is.
const plan = (startDate: string, logs: Plan["logs"] = {}): Plan => ({
  id: "p1",
  name: "Test race",
  programId: program.id,
  startDate,
  logs,
});
const alerts: AlertSettings = { phone: "+15550001111", time: "06:30", enabled: true };

// Day 2 of the plan (index 1) is a Tuesday 3 mi run; day 1 (Monday) is rest.
const startedYesterday = plan(addDaysISO(today, -1)); // today = day 2 = run day
const startedToday = plan(today); // today = day 1 = rest day

// 1. Workout day fires at the alert time.
check(
  "workout day fires at alert time",
  dueAlert(startedYesterday, program, alerts, { iso: today, minutes: 390 })?.key ===
    `workout:${today}`
);
// 2. Not before the alert time.
check(
  "workout day silent before alert time",
  dueAlert(startedYesterday, program, alerts, { iso: today, minutes: 380 }) === null
);
// 3. Rest day: silence.
check(
  "rest day stays silent",
  dueAlert(startedToday, program, alerts, { iso: today, minutes: 390 }) === null
);
// 4. Already-completed workout: silence.
check(
  "completed workout stays silent",
  dueAlert(
    plan(addDaysISO(today, -1), { "1-1": { completed: true } }),
    program,
    alerts,
    { iso: today, minutes: 390 }
  ) === null
);
// 5. Day before race (Saturday of week 12 = a rest day) sends the pep talk.
const raceIso = addDaysISO(today, 1); // pretend race is tomorrow
const raceTomorrowPlan = plan(addDaysISO(raceIso, -(program.weeks * 7 - 1)));
const preRace = dueAlert(raceTomorrowPlan, program, alerts, { iso: today, minutes: 390 });
check("day before race sends pep talk", preRace?.key === `prerace:${today}`);
check(
  "pep talk waits for alert time",
  dueAlert(raceTomorrowPlan, program, alerts, { iso: today, minutes: 300 }) === null
);
// 6. Race day fires at 7:00 regardless of alert time (alert time is 6:30).
const raceTodayPlan = plan(addDaysISO(today, -(program.weeks * 7 - 1)));
check(
  "race day fires at 7am",
  dueAlert(raceTodayPlan, program, alerts, { iso: today, minutes: 425 })?.key ===
    `race:${today}`
);
check(
  "race day silent before 7am even past alert time",
  dueAlert(raceTodayPlan, program, alerts, { iso: today, minutes: 400 }) === null
);
// 7. No start date: silence.
check(
  "plan without start date stays silent",
  dueAlert({ ...startedYesterday, startDate: undefined }, program, alerts, {
    iso: today,
    minutes: 390,
  }) === null
);
// 8. localNow resolves a real timezone.
const ny = localNow("America/New_York");
check("localNow returns ISO date + minutes", /^\d{4}-\d{2}-\d{2}$/.test(ny.iso) && ny.minutes >= 0 && ny.minutes < 1440);

/* ------------------------- predictor + achievements ---------------------- */

const loggedPlan = plan(addDaysISO(today, -13), {
  "1-1": { completed: true, miles: 3, seconds: 1620 }, // 9:00/mi
  "1-3": { completed: true, miles: 3, seconds: 1560 },
  "1-5": { completed: true, miles: 4, seconds: 2200 },
  "2-1": { completed: true, miles: 3, seconds: 1500 }, // 8:20/mi best
});
const pred = predictRace(loggedPlan, program);
check("predictor returns a result", pred !== null);
// Riegel from 3 mi @ 1500s: 1500 * (13.1094/3)^1.06 = ~7150s (~1:59)
check(
  "predictor uses fastest qualifying run",
  pred !== null && Math.abs(pred.seconds - 1500 * Math.pow(13.1094 / 3, 1.06)) < 1
);

const state: RunnerState = {
  plans: [loggedPlan],
  activePlanId: "p1",
  alerts,
};
const ach = computeAchievements(state);
const byId = Object.fromEntries(ach.map((a) => [a.id, a]));
check("fastest mile unlocked", byId["fastest-mile"].unlocked);
check("fastest 5K unlocked (3+ mi runs exist)", byId["fastest-5k"].unlocked);
check("fastest 10K locked (no 6.2+ mi run)", !byId["fastest-10k"].unlocked);
check("fastest mile detail is 8:20", byId["fastest-mile"].detail === "8:20");

// Streak: complete every workout for the first 12 plan days.
const fullLogs: Plan["logs"] = {};
for (const [week, days] of [
  [1, [1, 2, 3, 5, 6]],
  [2, [1, 2, 3, 5, 6]],
] as const) {
  for (const d of days) fullLogs[`${week}-${d}`] = { completed: true, miles: 3, seconds: 1600 };
}
const streakPlan = plan(addDaysISO(today, -13), fullLogs);
const streak = bestStreak(streakPlan, program);
check(`14-day kept streak counted (got ${streak})`, streak === 14);

const missedLogs = { ...fullLogs };
delete missedLogs["2-1"]; // miss day 9
const brokenStreak = bestStreak(plan(addDaysISO(today, -13), missedLogs), program);
check(`missed day breaks streak (got ${brokenStreak})`, brokenStreak === 8);

process.exit(failures > 0 ? 1 : 0);

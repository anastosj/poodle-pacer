/**
 * The Progress page's windows. Run with: npx tsx scripts/check-scopes.ts
 *
 * "Whole plan" used to run from the earliest thing in the account to the
 * latest, which on a second plan quietly meant "everything you have ever
 * synced". It has to mean the plan: first training day through race day, and
 * nothing on either side of it.
 */
import { computeInsights } from "../src/lib/insights";
import { toLocalISO } from "../src/lib/dates";
import type { Program, Workout } from "../src/lib/programs";
import type { Plan, SyncedRun } from "../src/lib/store";

let fails = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(
    ok ? "PASS" : "FAIL",
    label,
    ok ? "" : `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`
  );
};

const run = (miles: number): Workout => ({
  type: "run",
  label: `${miles} mi run`,
  miles,
});

const program: Program = {
  id: "t",
  name: "t",
  author: "t",
  weeks: 4,
  description: "",
  available: true,
  category: "running",
  raceLabel: "",
  raceDistanceMiles: 13.1,
  sourceUrl: "",
  sourceLabel: "",
  schedule: Array.from({ length: 4 }, (_, i) => ({
    week: i + 1,
    days: Array.from({ length: 7 }, () => run(2)),
  })),
};

/** Dates relative to today, so the rolling windows are exercised for real. */
const ago = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toLocalISO(d);
};

// A four-week plan that finished a fortnight ago.
const plan: Plan = {
  id: "p",
  name: "p",
  programId: "t",
  startDate: ago(41),
  logs: {},
};

const syncedRun = (date: string, miles: number): SyncedRun => ({
  stravaActivityId: Number(date.replace(/-/g, "")) + Math.round(miles * 100),
  date,
  sportType: "Run",
  miles,
  seconds: Math.round(miles * 540),
});

/*
 * Three runs, one in each region that matters: long before the plan began, a
 * fortnight into it, and after race day.
 */
const runs = [
  syncedRun(ago(300), 100),
  syncedRun(ago(30), 7),
  syncedRun(ago(3), 9),
];

const wholePlan = computeInsights(plan, program, "plan", runs);
if (!wholePlan) throw new Error("expected insights for the plan scope");

eq("the plan window opens on the first training day", toLocalISO(wholePlan.current.start), ago(41));
eq("and closes on race day", toLocalISO(wholePlan.current.end), ago(14));
eq(
  "so only the run inside the plan counts",
  wholePlan.current.miles,
  7
);

const sixMonths = computeInsights(plan, program, "6mo", runs);
if (!sixMonths) throw new Error("expected insights for the 6mo scope");

eq("six months ends today", toLocalISO(sixMonths.current.end), ago(0));
eq(
  "and reaches about half a year back",
  Math.round(
    (sixMonths.current.end.getTime() - sixMonths.current.start.getTime()) /
      86400000 /
      30
  ),
  6
);
eq(
  "picking up the runs on both sides of the plan, but not the one 300 days ago",
  sixMonths.current.miles,
  16
);
eq("and it has a previous half-year to compare with", sixMonths.previous !== undefined, true);

const thisMonth = computeInsights(plan, program, "month", runs);
eq("a month is still a calendar month", thisMonth?.current.start.getDate(), 1);

console.log(fails === 0 ? "\nall passed" : `\n${fails} failed`);
process.exit(fails === 0 ? 0 : 1);

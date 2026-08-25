/**
 * Checks that an activity lands in the plan slot for the day it was actually
 * done. Run with: npx tsx scripts/check-slot-matching.ts
 *
 * Both hazards here are invisible in the common case and only bite at the
 * edges, which is exactly why they are worth pinning down.
 */
import { applySyncedRuns } from "../src/lib/sync";
import type { Program, Workout } from "../src/lib/programs";
import type { RunnerState } from "../src/lib/store";

let fails = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? "PASS" : "FAIL", label, ok ? "" : `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
};

const w = (type: Workout["type"], label = type): Workout => ({ type, label });

/** 20 weeks of plain run days, so any date in range lands on a run slot. */
const program: Program = {
  id: "t",
  name: "t",
  author: "t",
  weeks: 20,
  description: "",
  available: true,
  category: "running",
  raceLabel: "",
  sourceUrl: "",
  sourceLabel: "",
  schedule: Array.from({ length: 20 }, (_, i) => ({
    week: i + 1,
    days: Array.from({ length: 7 }, () => w("run")),
  })),
};

const stateFrom = (startDate: string): RunnerState => ({
  plans: [{ id: "p", name: "p", programId: "t", startDate, logs: {} }],
  activePlanId: "p",
  alerts: { phone: "", time: "07:00", enabled: false },
});

const run = (id: number, startDate: string) => ({
  id,
  name: "Run",
  miles: 3,
  seconds: 1800,
  startDate,
  sportType: "Run",
});

/* The bug: Strava stamps local wall-clock time with a trailing Z. A 00:30
   local run therefore looks like 00:30 UTC, which in any negative-offset zone
   is the previous evening — and filled the previous day's slot. */
{
  const out = applySyncedRuns(stateFrom("2026-08-24"), program, [
    run(1, "2026-08-25T00:30:00Z"), // day 2 of the plan
  ]);
  eq("00:30 run logged on its own date", out.state.runs?.[0].date, "2026-08-25");
  eq("00:30 run fills day 2, not day 1", Object.keys(out.state.plans[0].logs), ["1-1"]);
}

/* Midday is unambiguous in either reading, so it guards the fix itself. */
{
  const out = applySyncedRuns(stateFrom("2026-08-24"), program, [
    run(2, "2026-08-25T12:00:00Z"),
  ]);
  eq("midday run still fills day 2", Object.keys(out.state.plans[0].logs), ["1-1"]);
}

/* First day of the plan, earliest possible hour: must not fall off the front. */
{
  const out = applySyncedRuns(stateFrom("2026-08-24"), program, [
    run(3, "2026-08-24T00:05:00Z"),
  ]);
  eq("first-day 00:05 run fills day 1", Object.keys(out.state.plans[0].logs), ["1-0"]);
}

/* Across the US DST change (1 Nov 2026), two local midnights are 25 hours
   apart, so a floored day count would drop a day for the rest of the plan. */
{
  const out = applySyncedRuns(stateFrom("2026-10-26"), program, [
    run(4, "2026-11-09T09:00:00Z"), // exactly 14 days later
  ]);
  eq("post-DST run keeps its true day offset", Object.keys(out.state.plans[0].logs), ["3-0"]);
}

/* And across the spring change (8 Mar 2026), where a day is 23 hours. */
{
  const out = applySyncedRuns(stateFrom("2026-03-02"), program, [
    run(5, "2026-03-16T09:00:00Z"), // exactly 14 days later
  ]);
  eq("post-spring-DST run keeps its true day offset", Object.keys(out.state.plans[0].logs), ["3-0"]);
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);

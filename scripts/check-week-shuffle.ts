/**
 * Covers the three things that had to stay true once a runner could move a
 * workout to another day of the week. Run with:
 *   npx tsx scripts/check-week-shuffle.ts
 *
 *  - a moved workout keeps its log, and the week keeps its whole load;
 *  - an activity done on the wrong day still finds the slot it was meant for,
 *    without ever stealing one that is already spoken for;
 *  - a HIIT class or a spin session can complete a cross-training day, and
 *    contributes exactly zero running miles when it does.
 */
import { planCells } from "../src/lib/calendar";
import { runningMilesFor } from "../src/lib/mileage";
import { applySyncedRuns, workoutAcceptsActivity } from "../src/lib/sync";
import type { FetchedRun } from "../src/lib/sync";
import type { Program, Workout } from "../src/lib/programs";
import type { Plan, RunnerState } from "../src/lib/store";
import {
  isWeekReordered,
  resetWeekOrder,
  swapWorkoutDays,
} from "../src/lib/store";

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
const rest: Workout = { type: "rest", label: "Rest" };
const cross: Workout = { type: "cross", label: "Cross-train 45 min", minutes: 45 };

/** Mon 3 mi · Tue 5 mi · Wed cross · Thu rest · Fri 3 mi · Sat rest · Sun 8 mi */
const program: Program = {
  id: "t",
  name: "t",
  author: "t",
  weeks: 4,
  description: "",
  available: true,
  category: "running",
  raceLabel: "",
  sourceUrl: "",
  sourceLabel: "",
  schedule: Array.from({ length: 4 }, (_, i) => ({
    week: i + 1,
    days: [run(3), run(5), cross, rest, run(3), rest, run(8)],
  })),
};

// Week 1 is Mon 6 Jan 2025 through Sun 12 Jan 2025.
const START = "2025-01-06";

const planWith = (overrides: Partial<Plan> = {}): Plan => ({
  id: "p",
  name: "p",
  programId: "t",
  startDate: START,
  logs: {},
  ...overrides,
});

const stateWith = (plan: Plan): RunnerState => ({
  plans: [plan],
  activePlanId: plan.id,
  alerts: { phone: "", time: "07:00", enabled: false },
});

const activity = (
  id: number,
  date: string,
  miles: number,
  sportType = "Run"
): FetchedRun => ({
  id,
  name: `activity ${id}`,
  miles,
  seconds: Math.round(miles * 540),
  startDate: `${date}T09:00:00Z`,
  sportType,
});

const dayOf = (plan: Plan, iso: string) =>
  planCells(program, plan).find((c) => c.iso === iso);

/* ---------------------------------------------------------------- moving -- */

const base = planWith();
eq("week 1 starts in program order", dayOf(base, "2025-01-07")?.workout.label, "5 mi run");

// Tuesday's 5 miler moves to Thursday, trading places with the rest day.
const moved = swapWorkoutDays(base, 1, 1, 3);
eq("moved workout lands on Thursday", dayOf(moved, "2025-01-09")?.workout.label, "5 mi run");
eq("the rest day it swapped with takes Tuesday", dayOf(moved, "2025-01-07")?.workout.label, "Rest");
eq("the week is flagged as rearranged", isWeekReordered(moved, 1), true);
eq("other weeks are untouched", isWeekReordered(moved, 2), false);

const week1 = planCells(program, moved).filter((c) => c.week === 1);
eq("the week still holds seven days", week1.length, 7);
eq(
  "and the same total mileage",
  week1.reduce((sum, c) => sum + (c.workout.miles ?? 0), 0),
  19
);

// A log is written against the workout, not the date, so it travels with it.
const logged = swapWorkoutDays(
  planWith({ logs: { "1-1": { completed: true, miles: 5.2 } } }),
  1,
  1,
  3
);
eq("the log follows its workout", dayOf(logged, "2025-01-09")?.key, "1-1");
eq("and Tuesday is clear again", logged.logs[dayOf(logged, "2025-01-07")!.key], undefined);

eq("resetting puts the week back", isWeekReordered(resetWeekOrder(moved, 1), 1), false);
eq(
  "and the workout with it",
  dayOf(resetWeekOrder(moved, 1), "2025-01-07")?.workout.label,
  "5 mi run"
);

/* ------------------------------------------------------- matching by date -- */

// Sync sees the calendar the runner sees, not the one the program wrote.
const onMovedDay = applySyncedRuns(stateWith(moved), program, [
  activity(1, "2025-01-09", 5.1),
]);
eq("an activity matches the moved workout's new day", onMovedDay.state.plans[0].logs["1-1"]?.stravaActivityId, 1);
eq("counted as a match", onMovedDay.matched, 1);
eq("and not as a reorder", onMovedDay.reordered, 0);

/* --------------------------------------------------- matching out of order -- */

// Tuesday's 5 miler actually run on Wednesday, which is a cross-training day.
const late = applySyncedRuns(stateWith(planWith()), program, [
  activity(2, "2025-01-08", 5.0),
]);
eq("a run done a day late fills Tuesday's slot", late.state.plans[0].logs["1-1"]?.stravaActivityId, 2);
eq("reported as reordered", late.reordered, 1);
eq("and remembers the day it was really done", late.state.plans[0].logs["1-1"]?.loggedDate, "2025-01-08");

// Distance picks the slot, not proximity: 8 miles is the Sunday long run even
// though Friday's 3 miler is the nearer empty day.
const long = applySyncedRuns(stateWith(planWith()), program, [
  activity(3, "2025-01-11", 8.1),
]);
eq("distance decides which slot a stray run fills", long.state.plans[0].logs["1-6"]?.stravaActivityId, 3);

// Two runs on one day: the first takes the slot for that day, the second is
// offered the rest of the week rather than overwriting it.
const twoInADay = applySyncedRuns(stateWith(planWith()), program, [
  activity(4, "2025-01-07", 5.0),
  activity(5, "2025-01-07", 3.1),
]);
eq("the first run keeps Tuesday", twoInADay.state.plans[0].logs["1-1"]?.stravaActivityId, 4);
eq("the second finds Monday's 3 miler", twoInADay.state.plans[0].logs["1-0"]?.stravaActivityId, 5);

// A slot already holding an activity is never reassigned on a later sync.
const resync = applySyncedRuns(twoInADay.state, program, [
  activity(6, "2025-01-08", 5.0),
]);
eq("a taken slot is left alone", resync.state.plans[0].logs["1-1"]?.stravaActivityId, 4);

// Nothing to match against outside its own week: a run in week 2 never
// completes a week 1 slot.
const nextWeek = applySyncedRuns(stateWith(planWith()), program, [
  activity(7, "2025-01-15", 5.0),
]);
eq("week 2 slots take week 2 activities", nextWeek.state.plans[0].logs["2-1"]?.stravaActivityId, 7);
eq("week 1 is untouched", nextWeek.state.plans[0].logs["1-1"], undefined);

/* --------------------------------------------- cross-training and mileage -- */

eq("weights complete a cross day", workoutAcceptsActivity(cross, "other"), true);
eq("so does a HIIT class on a run-or-cross day", workoutAcceptsActivity({ type: "run-or-cross", label: "", miles: 3 }, "other"), true);
eq("but never a running day", workoutAcceptsActivity(run(5), "other"), false);
eq("and never a rest day", workoutAcceptsActivity(rest, "other"), false);

const hiit = applySyncedRuns(stateWith(planWith()), program, [
  { ...activity(8, "2025-01-08", 0), sportType: "WeightTraining", seconds: 2700 },
]);
eq("a weights session fills Wednesday's cross day", hiit.state.plans[0].logs["1-2"]?.stravaActivityId, 8);

// The mileage rule, which is what keeps a spin class out of the run totals.
eq("a HIIT class on a run-or-cross day is zero running miles",
  runningMilesFor(
    { type: "run-or-cross", label: "3 mi run or cross", miles: 3 },
    { completed: true, miles: 2.4, sportType: "Workout" }
  ),
  0
);
eq("so is a ride",
  runningMilesFor(run(5), { completed: true, miles: 18, sportType: "Ride" }),
  0
);
eq("an actual run counts what it covered",
  runningMilesFor(run(5), { completed: true, miles: 5.2, sportType: "Run" }),
  5.2
);
eq("a legacy log with no sport is still a run",
  runningMilesFor(run(5), { completed: true, miles: 5.2 }),
  5.2
);
eq("a run-or-cross with nothing recorded claims nothing",
  runningMilesFor(
    { type: "run-or-cross", label: "3 mi run or cross", miles: 3 },
    { completed: true }
  ),
  0
);
eq("a plain run day falls back to what was planned",
  runningMilesFor(run(5), { completed: true }),
  5
);

console.log(fails === 0 ? "\nall passed" : `\n${fails} failed`);
process.exit(fails === 0 ? 0 : 1);

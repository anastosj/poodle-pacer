/**
 * Covers what has to stay true once a runner can say which workout an activity
 * really was. Run with: npx tsx scripts/check-match-override.ts
 *
 *  - a correction moves the activity, empties the slot it came from, and
 *    survives the next sync rather than being guessed at again;
 *  - an activity taken off the plan stays off it;
 *  - the pickers offer only what can honestly be picked.
 *
 * The last point is the one with teeth: a correction that the next refresh
 * undoes is worse than no correction at all, because the runner has no reason
 * to look twice.
 */
import { planCells } from "../src/lib/calendar";
import { activityChoicesFor, slotChoicesFor } from "../src/lib/matching";
import { runningMilesFor } from "../src/lib/mileage";
import { applySyncedRuns } from "../src/lib/sync";
import type { FetchedRun } from "../src/lib/sync";
import type { Program, Workout } from "../src/lib/programs";
import type { Plan, RunnerState } from "../src/lib/store";
import {
  OFF_PLAN,
  matchActivityToSlot,
  normalizeState,
  unmatchSlot,
  unmatchedRuns,
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

const planOf = (state: RunnerState) => state.plans[0];
const slotOf = (state: RunnerState, id: number) =>
  Object.keys(planOf(state).logs).find(
    (key) => planOf(state).logs[key].stravaActivityId === id
  );

/* ------------------------------------------------------------ correcting -- */

/*
 * Saturday is a rest day, so a 4.4 mile run done on it is offered the days
 * either side, and distance decides: next Tuesday's 5 miler fits better than
 * Friday's 3 or Sunday's 8, so that is where it goes — three days later and in
 * a week the runner had not started. This is the miss the feature is for. It
 * was Sunday's long run, cut short, and only the runner knows that.
 */
const guessed = applySyncedRuns(stateWith(planWith()), program, [
  activity(1, "2025-01-11", 4.4),
]);
eq("the matcher files the run into the next week", slotOf(guessed.state, 1), "2-1");

const corrected = matchActivityToSlot(guessed.state, 1, "1-6");
eq("the correction moves it to Sunday", slotOf(corrected, 1), "1-6");
eq("and the slot it came from is empty again", corrected.plans[0].logs["2-1"], undefined);
eq(
  "the day it was really done is kept",
  corrected.plans[0].logs["1-6"].loggedDate,
  "2025-01-11"
);
eq(
  "the miles are credited to the workout it completed",
  runningMilesFor(run(8), corrected.plans[0].logs["1-6"]),
  4.4
);
eq(
  "and the decision is written down",
  corrected.plans[0].matchOverrides,
  { "1": "1-6" }
);

// The same activities come back on every refresh, so this is the case that
// decides whether a correction was worth making.
const resynced = applySyncedRuns(corrected, program, [
  activity(1, "2025-01-11", 4.4),
]);
eq("a resync leaves it where the runner put it", slotOf(resynced.state, 1), "1-6");
eq(
  "and does not also refill the slot it came from",
  Object.keys(resynced.state.plans[0].logs),
  ["1-6"]
);

/* -------------------------------------------------------------- undoing -- */

const detached = unmatchSlot(corrected, "1-6");
eq("unmatching empties the slot", detached.plans[0].logs["1-6"], undefined);
eq(
  "the activity is back in the loose log",
  unmatchedRuns(detached, detached.plans[0]).map((r) => r.stravaActivityId),
  [1]
);
eq(
  "recorded as off the plan",
  detached.plans[0].matchOverrides,
  { "1": OFF_PLAN }
);

const afterUndo = applySyncedRuns(detached, program, [
  activity(1, "2025-01-11", 4.4),
]);
eq("and the next sync leaves it alone", Object.keys(afterUndo.state.plans[0].logs), []);
eq("so nothing is reported as matched", afterUndo.matched, 0);

/* ------------------------------------------------------------ displacing -- */

/*
 * Two runs over one weekend, and the runner decides the second of them is the
 * long run. Sunday can only hold one, so the first goes back to the loose log
 * rather than being quietly re-filed somewhere by the next sync: the runner
 * has just said what that slot was, and the loser of that is not a new guess
 * to make.
 */
const pair = applySyncedRuns(stateWith(planWith()), program, [
  activity(2, "2025-01-11", 8.1),
  activity(3, "2025-01-12", 3.2),
]);
const pinned = matchActivityToSlot(pair.state, 2, "1-6");
eq("the 8 miler is pinned to Sunday", slotOf(pinned, 2), "1-6");

const swapped = matchActivityToSlot(pinned, 3, "1-6");
eq("pinning the short run takes Sunday", slotOf(swapped, 3), "1-6");
eq("and the 8 miler is displaced", slotOf(swapped, 2), undefined);
eq(
  "with the displacement recorded",
  swapped.plans[0].matchOverrides,
  { "2": OFF_PLAN, "3": "1-6" }
);
const afterSwap = applySyncedRuns(swapped, program, [
  activity(2, "2025-01-11", 8.1),
  activity(3, "2025-01-12", 3.2),
]);
eq(
  "which a resync respects on both sides",
  [slotOf(afterSwap.state, 3), slotOf(afterSwap.state, 2)],
  ["1-6", undefined]
);

/* ------------------------------------------------------- filed only once -- */

/*
 * Two runs on one Monday: the first takes Monday's slot and the second is
 * credited to a neighbouring day. Freeing Monday again must not then hand the
 * second run that slot as well on the next refresh — an activity in two slots
 * is a workout completed twice and miles counted twice.
 */
const doubleUp = applySyncedRuns(stateWith(planWith()), program, [
  activity(4, "2025-01-13", 3.1),
  activity(5, "2025-01-13", 5.1),
]);
eq("the first run takes Monday", slotOf(doubleUp.state, 4), "2-0");
eq("the second is credited nearby", slotOf(doubleUp.state, 5), "2-1");

const freed = unmatchSlot(doubleUp.state, "2-0");
const refreshed = applySyncedRuns(freed, program, [
  activity(4, "2025-01-13", 3.1),
  activity(5, "2025-01-13", 5.1),
]);
eq(
  "and the free Monday does not collect the second run as well",
  Object.keys(refreshed.state.plans[0].logs),
  ["2-1"]
);

/* --------------------------------------------------------- what is offered -- */

const cells = planCells(program, planWith());
const loose = unmatchedRuns(afterUndo.state, afterUndo.state.plans[0]);

eq(
  "a workout is offered the loose activities near it",
  activityChoicesFor("2025-01-12", loose).map((r) => r.stravaActivityId),
  [1]
);
eq(
  "and nothing when they are weeks away",
  activityChoicesFor("2025-02-02", loose).length,
  0
);

const choices = slotChoicesFor("2025-01-11", cells, planWith());
eq(
  // Friday and Sunday either side of it, then the Monday after: nearest day
  // first, and a program week boundary is not a wall.
  "an activity is offered the nearest workouts first",
  choices.slice(0, 3).map((c) => c.cell.key),
  ["1-4", "1-6", "2-0"]
);
eq(
  "rest days are never offered",
  choices.some((c) => c.cell.workout.type === "rest"),
  false
);

const taken = slotChoicesFor("2025-01-11", cells, planOf(corrected)).find(
  (c) => c.cell.key === "1-6"
);
eq("a slot already filled says what it holds", taken?.takenBy, "activity 1");

const ticked = slotChoicesFor("2025-01-11", cells, planWith({
  logs: { "1-6": { completed: true } },
})).find((c) => c.cell.key === "1-6");
eq("one ticked off by hand says so", ticked?.markedDone, true);

/* -------------------------------------------------------------- storing -- */

const round = normalizeState(JSON.parse(JSON.stringify(corrected)));
eq("decisions survive a save and load", round.plans[0].matchOverrides, {
  "1": "1-6",
});
const junk = normalizeState({
  ...corrected,
  plans: [
    {
      ...corrected.plans[0],
      matchOverrides: { "1": "1-6", "2": "nonsense", nope: "1-1" },
    },
  ],
});
eq("and nothing unreadable comes back with them", junk.plans[0].matchOverrides, {
  "1": "1-6",
});

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);

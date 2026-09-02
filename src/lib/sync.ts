import { ActivityKind, activityKind, tracksDistance } from "@/lib/activities";
import { fromISO } from "@/lib/dates";
import {
  Program,
  Workout,
  workoutTracksRunningMiles,
  yardsToMiles,
} from "@/lib/programs";
import {
  Plan,
  RunLog,
  RunnerState,
  SyncedRun,
  activePlan,
  beginWeekOf,
  dayIndexAt,
  logKey,
  mergeRuns,
} from "@/lib/store";

/** Shape returned by /api/strava/activities. */
export interface FetchedRun {
  id: number;
  name: string;
  miles: number;
  seconds: number;
  startDate: string; // ISO datetime, local to the athlete
  sportType?: string;
  avgHeartRate?: number;
  maxHeartRate?: number;
  elevationGain?: number;
  cadence?: number;
}

export interface SyncOutcome {
  state: RunnerState;
  /** Runs newly added to the run log. */
  added: number;
  /** Runs matched to a slot of the active plan. */
  matched: number;
  /**
   * Of those, the ones that filled a slot on a different day from the one they
   * were done on. Worth reporting separately: it is the only kind of match the
   * runner did not obviously ask for.
   */
  reordered: number;
}

/**
 * The calendar date an activity happened on, as the athlete experienced it.
 *
 * Strava sends `start_date_local`: local wall-clock time, but stamped with a
 * trailing Z as though it were UTC. Reading the date off the string is the only
 * safe way to take it; `new Date(...)` would treat that Z as real and shift the
 * day for anyone west of Greenwich.
 */
function localDateOf(run: FetchedRun): string {
  return run.startDate.slice(0, 10);
}

function toSyncedRun(run: FetchedRun): SyncedRun {
  return {
    stravaActivityId: run.id,
    date: localDateOf(run),
    name: run.name,
    sportType: run.sportType,
    miles: run.miles,
    seconds: run.seconds,
    avgHeartRate: run.avgHeartRate,
    maxHeartRate: run.maxHeartRate,
    elevationGain: run.elevationGain,
    cadence: run.cadence,
  };
}

/**
 * How far out of order a session may be credited, in days either side of the
 * day it was actually done.
 *
 * Three days rather than the rest of the calendar week, because the window has
 * to be about how late a workout can plausibly be and still be that workout —
 * and a week boundary is the wrong shape for that. A Sunday long run finished
 * on the Monday is one day late; that it lands in the next program week is an
 * accident of where the plan happens to be cut. Meanwhile a Monday run and the
 * Sunday six days after it are in the same week and have nothing to do with
 * each other.
 */
const MATCH_WINDOW_DAYS = 3;

/**
 * The first and last day of the plan the runner actually trains, as offsets
 * from the plan's start date.
 *
 * The lower bound is `beginWeek`, not day zero. Weeks before it are not on the
 * calendar at all — a runner who joined a 12 week program four weeks out never
 * sees weeks 1 to 8 — so an activity filed into one would be counted as
 * matched, vanish from the loose activity log, and then have no cell to render
 * in. It would simply disappear.
 */
function trainingDayBounds(
  plan: Plan,
  weeks: number
): { first: number; last: number } {
  return { first: (beginWeekOf(plan) - 1) * 7, last: weeks * 7 - 1 };
}

/**
 * Which day of the plan a calendar date falls on, counted from the start date,
 * or null for a date outside the weeks the runner trains. Both dates are taken
 * as local midnight.
 *
 * Rounding rather than flooring the day count matters across a daylight saving
 * change, where two local midnights are 23 or 25 hours apart and a floor would
 * put the whole rest of the plan out by a day.
 */
function planDayFor(
  iso: string,
  plan: Plan,
  weeks: number
): number | null {
  const start = fromISO(plan.startDate!);
  const day = Math.round((fromISO(iso).getTime() - start.getTime()) / 86400000);
  const { first, last } = trainingDayBounds(plan, weeks);
  return day < first || day > last ? null : day;
}

/** The workout on a given day of the plan, honouring any days the runner moved. */
function workoutOn(
  program: Program,
  plan: Plan,
  day: number
): { workout: Workout; key: string } | null {
  const week = Math.floor(day / 7) + 1;
  const days = program.schedule.find((w) => w.week === week)?.days;
  if (!days) return null;
  // A short final week has no day at the later positions, and no order of its
  // own either; `dayIndexAt` is told its length so both stay true here.
  const dayIndex = dayIndexAt(plan, week, day % 7, days.length);
  const workout = days[dayIndex];
  if (!workout) return null;
  return { workout, key: logKey(week, dayIndex) };
}

/**
 * Which plan slots a given sport can complete. Running fills the running
 * slots as it always has; a swim or a ride fills its own discipline's day.
 *
 * Everything else — weights, a HIIT class, yoga, a hike — is cross-training,
 * and cross-training is exactly what a cross day and the second half of a
 * run-or-cross day are asking for. Matching them is only about crediting the
 * session: what a HIIT class never does is add miles, and `runningMilesFor`
 * is what makes sure of that.
 */
export function workoutAcceptsActivity(
  workout: Workout,
  kind: ActivityKind
): boolean {
  if (workout.type === "rest") return false;
  if (kind === "run") return workoutTracksRunningMiles(workout);
  if (workout.type === "cross" || workout.type === "run-or-cross") return true;
  if (kind === "ride") return workout.type === "bike";
  if (kind === "swim") return workout.type === "swim";
  return false;
}

/** Nothing has claimed this slot yet, so an out-of-order run may take it. */
function slotIsFree(log: RunLog | undefined): boolean {
  return !log?.completed && log?.stravaActivityId === undefined;
}

/** The distance a workout asks for, in miles, whatever unit it states. */
function plannedMiles(workout: Workout): number {
  if (typeof workout.miles === "number") return workout.miles;
  if (typeof workout.yards === "number") return yardsToMiles(workout.yards);
  return 0;
}

/**
 * How well an activity fits a slot it did not land on. Lower is better.
 *
 * Distance decides it where there is one on both sides — a 4 mile run belongs
 * in the 3 mile slot nearby, not the 10 mile long run — and the gap in days
 * settles everything else, so a session slides to the nearest day it could
 * plausibly have been. Weighting distance an order of magnitude above the day
 * gap is what stops a stray run being swallowed by whichever empty slot merely
 * sits closest.
 */
function fitCost(
  workout: Workout,
  run: FetchedRun,
  kind: ActivityKind,
  dayGap: number
): number {
  const planned = plannedMiles(workout);
  const distanceGap =
    planned > 0 && run.miles > 0 && tracksDistance(kind)
      ? Math.abs(planned - run.miles) / planned
      : // No distance to compare: a fixed middling cost, so a slot that does
        // have a comparable distance still wins outright.
        1;
  return distanceGap * 10 + dayGap;
}

function logFor(run: FetchedRun, existing: RunLog | undefined): RunLog {
  return {
    ...existing,
    completed: true,
    // Every sport's real distance is kept now that the log records which
    // sport it was: the consumers that only want running miles ask.
    miles: run.miles,
    sportType: run.sportType,
    seconds: run.seconds,
    minutes: undefined, // superseded by `seconds`
    stravaActivityId: run.id,
    stravaName: run.name,
    avgHeartRate: run.avgHeartRate,
    maxHeartRate: run.maxHeartRate,
    elevationGain: run.elevationGain,
    cadence: run.cadence,
  };
}

/**
 * Fold fetched Strava activities into the runner's state: every activity lands
 * in the date-keyed log whatever the sport, and one that falls on a slot of the
 * active plan it can complete also fills that slot.
 *
 * Two passes, because training weeks are not done in the order they are
 * written. The first credits activities to the day they actually happened on.
 * The second offers whatever is left the days within `MATCH_WINDOW_DAYS`
 * either side: a Tuesday tempo run finally done on Thursday still completes
 * Tuesday's slot, and a Sunday long run finished on the Monday still completes
 * Sunday's, as long as nothing else has claimed it. The log remembers the real
 * date so the calendar can say so.
 */
export function applySyncedRuns(
  state: RunnerState,
  program: Program,
  fetched: FetchedRun[]
): SyncOutcome {
  const { runs, added } = mergeRuns(state.runs ?? [], fetched.map(toSyncedRun));

  const plan = activePlan(state);
  let matched = 0;
  let reordered = 0;
  let logs = plan.logs;
  if (plan.startDate) {
    logs = { ...plan.logs };
    // Oldest first, so the earlier of two candidates for one slot gets it and
    // the later one falls through to the second pass.
    const ordered = [...fetched].sort((a, b) =>
      localDateOf(a).localeCompare(localDateOf(b))
    );
    const leftover: { run: FetchedRun; iso: string; day: number }[] = [];
    // Which activities already sit in some slot, so the second pass never
    // files one twice and never has to walk the whole log to find out.
    const claimed = new Set<number>();
    for (const log of Object.values(logs)) {
      if (log.stravaActivityId !== undefined) claimed.add(log.stravaActivityId);
    }

    for (const run of ordered) {
      const iso = localDateOf(run);
      const day = planDayFor(iso, plan, program.weeks);
      if (day === null) continue;
      const slot = workoutOn(program, plan, day);
      const kind = activityKind(run.sportType);
      if (!slot || !workoutAcceptsActivity(slot.workout, kind)) {
        leftover.push({ run, iso, day });
        continue;
      }
      const existing = logs[slot.key];
      if (existing?.stravaActivityId === run.id) continue;
      // A slot already holding a different activity is taken; a slot merely
      // ticked off by hand is not, and syncing is how it gets its numbers.
      if (existing?.stravaActivityId !== undefined) {
        leftover.push({ run, iso, day });
        continue;
      }
      logs[slot.key] = logFor(run, existing);
      claimed.add(run.id);
      matched += 1;
    }

    const bounds = trainingDayBounds(plan, program.weeks);

    for (const { run, iso, day } of leftover) {
      const kind = activityKind(run.sportType);
      // Already sitting in some slot of the plan from an earlier sync: leave
      // it where the runner has it rather than shuffling it every refresh.
      if (claimed.has(run.id)) continue;

      let best: { key: string; cost: number } | null = null;
      /*
       * Earliest candidate first, and only a strictly better fit displaces it,
       * so an exact tie resolves backwards — to the workout that was missed
       * and made up rather than to the one done early. Falling behind and
       * catching up is much the commoner story.
       */
      for (
        let candidate = Math.max(bounds.first, day - MATCH_WINDOW_DAYS);
        candidate <= Math.min(bounds.last, day + MATCH_WINDOW_DAYS);
        candidate += 1
      ) {
        if (candidate === day) continue;
        const slot = workoutOn(program, plan, candidate);
        if (!slot || !workoutAcceptsActivity(slot.workout, kind)) continue;
        // A race is the fixed point the whole plan is built around, and is
        // never something an ordinary Tuesday session quietly completes.
        if (slot.workout.type === "race") continue;
        if (!slotIsFree(logs[slot.key])) continue;
        const cost = fitCost(slot.workout, run, kind, Math.abs(candidate - day));
        if (!best || cost < best.cost) best = { key: slot.key, cost };
      }
      if (!best) continue;
      logs[best.key] = { ...logFor(run, logs[best.key]), loggedDate: iso };
      claimed.add(run.id);
      matched += 1;
      reordered += 1;
    }
  }

  return {
    state: {
      ...state,
      runs,
      plans: state.plans.map((p) => (p.id === plan.id ? { ...p, logs } : p)),
    },
    added,
    matched,
    reordered,
  };
}

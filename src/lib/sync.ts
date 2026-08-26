import { ActivityKind, activityKind } from "@/lib/activities";
import { fromISO } from "@/lib/dates";
import { Program, Workout, workoutTracksRunningMiles } from "@/lib/programs";
import {
  RunnerState,
  SyncedRun,
  activePlan,
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
 * Which plan slot a calendar date falls in, both dates taken as local midnight.
 *
 * Rounding rather than flooring the day count matters across a daylight saving
 * change, where two local midnights are 23 or 25 hours apart and a floor would
 * put the whole rest of the plan out by a day.
 */
function weekAndDayFor(
  iso: string,
  startDate: string,
  weeks: number
): { week: number; dayIndex: number } | null {
  const start = fromISO(startDate);
  const diffDays = Math.round(
    (fromISO(iso).getTime() - start.getTime()) / 86400000
  );
  if (diffDays < 0 || diffDays >= weeks * 7) return null;
  return { week: Math.floor(diffDays / 7) + 1, dayIndex: diffDays % 7 };
}

/**
 * Which plan slots a given sport can complete. Running fills the running
 * slots as it always has; other sports fill the cross-training slot they
 * match, and anything counts as the "cross" half of a run-or-cross day.
 */
export function workoutAcceptsActivity(
  workout: Workout,
  kind: ActivityKind
): boolean {
  if (kind === "run") return workoutTracksRunningMiles(workout);
  if (workout.type === "cross" || workout.type === "run-or-cross") return true;
  if (kind === "ride") return workout.type === "bike";
  if (kind === "swim") return workout.type === "swim";
  return false;
}

/**
 * Fold fetched Strava activities into the runner's state: every activity lands
 * in the date-keyed log whatever the sport, and one that falls on a slot of the
 * active plan it can complete also fills that slot.
 */
export function applySyncedRuns(
  state: RunnerState,
  program: Program,
  fetched: FetchedRun[]
): SyncOutcome {
  const { runs, added } = mergeRuns(state.runs ?? [], fetched.map(toSyncedRun));

  const plan = activePlan(state);
  let matched = 0;
  let logs = plan.logs;
  if (plan.startDate) {
    logs = { ...plan.logs };
    for (const run of fetched) {
      const slot = weekAndDayFor(
        localDateOf(run),
        plan.startDate,
        program.weeks
      );
      if (!slot) continue;
      const workout = program.schedule.find(
        (programWeek) => programWeek.week === slot.week
      )?.days[slot.dayIndex];
      if (!workout) continue;
      const kind = activityKind(run.sportType);
      if (!workoutAcceptsActivity(workout, kind)) continue;
      const key = logKey(slot.week, slot.dayIndex);
      const existing = logs[key];
      if (existing?.stravaActivityId === run.id) continue;
      logs[key] = {
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
      matched += 1;
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
  };
}

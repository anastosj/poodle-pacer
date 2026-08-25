import { Program, workoutTracksRunningMiles } from "@/lib/programs";
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

function toSyncedRun(run: FetchedRun): SyncedRun {
  return {
    stravaActivityId: run.id,
    date: run.startDate.slice(0, 10),
    name: run.name,
    miles: run.miles,
    seconds: run.seconds,
    avgHeartRate: run.avgHeartRate,
    maxHeartRate: run.maxHeartRate,
    elevationGain: run.elevationGain,
    cadence: run.cadence,
  };
}

function weekAndDayFor(
  date: Date,
  startDate: string,
  weeks: number
): { week: number; dayIndex: number } | null {
  const start = new Date(startDate + "T00:00:00");
  const diffDays = Math.floor((date.getTime() - start.getTime()) / 86400000);
  if (diffDays < 0 || diffDays >= weeks * 7) return null;
  return { week: Math.floor(diffDays / 7) + 1, dayIndex: diffDays % 7 };
}

/**
 * Fold fetched Strava runs into the runner's state: every run lands in the
 * date-keyed run log, and runs that fall on a running slot of the active plan
 * also fill that slot, exactly as the old manual sync did.
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
        new Date(run.startDate),
        plan.startDate,
        program.weeks
      );
      if (!slot) continue;
      const workout = program.schedule.find(
        (programWeek) => programWeek.week === slot.week
      )?.days[slot.dayIndex];
      if (!workout || !workoutTracksRunningMiles(workout)) continue;
      const key = logKey(slot.week, slot.dayIndex);
      const existing = logs[key];
      if (existing?.stravaActivityId === run.id) continue;
      logs[key] = {
        ...existing,
        completed: true,
        miles: run.miles,
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

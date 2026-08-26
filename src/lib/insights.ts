import { ActivityKind, activityKind, countsAsRunning } from "@/lib/activities";
import { CalendarCell, planCells } from "@/lib/calendar";
import {
  addDays,
  fromISO,
  startOfCalendarWeek,
  startOfMonth,
  startOfToday,
} from "@/lib/dates";
import {
  Program,
  workoutIncludes,
  workoutTracksRunningMiles,
} from "@/lib/programs";
import { paceSecondsPerMile } from "@/lib/pace";
import {
  Plan,
  RunLog,
  SyncedRun,
  logSeconds,
} from "@/lib/store";

export type MetricScope = "week" | "month" | "plan";

export const SCOPE_LABELS: Record<MetricScope, string> = {
  week: "This week",
  month: "This month",
  plan: "Whole plan",
};

export interface PeriodStats {
  start: Date;
  end: Date;
  /** Workouts marked done / scheduled in the window (rest days excluded). */
  completed: number;
  scheduled: number;
  /**
   * Scheduled workouts whose day has actually arrived. Consistency measures
   * against this rather than `scheduled`, so tomorrow's run is not counted as
   * one you have already missed.
   */
  due: number;
  runCount: number;
  miles: number;
  plannedMiles: number;
  seconds: number;
  /** Weighted average pace across the period, in seconds per mile. */
  avgPace?: number;
  longestRun: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  elevationGain: number;
  avgCadence?: number;
}

export interface TrendPoint {
  label: string;
  miles: number;
  pace?: number;
  avgHeartRate?: number;
}

export interface Insights {
  current: PeriodStats;
  /** Same-length window immediately before `current`, for deltas. */
  previous?: PeriodStats;
  trend: TrendPoint[];
}

/** Completed over what was actually due, as a fraction in [0,1]. */
export function consistencyOf(stats: {
  completed: number;
  due: number;
}): number {
  return stats.due > 0 ? stats.completed / stats.due : 0;
}

/** Which of a program's three disciplines a synced sport corresponds to. */
const PROGRAM_SPORT: Partial<
  Record<ActivityKind, "running" | "cycling" | "swimming">
> = {
  run: "running",
  ride: "cycling",
  swim: "swimming",
};

const EMPTY = (start: Date, end: Date): PeriodStats => ({
  start,
  end,
  completed: 0,
  scheduled: 0,
  due: 0,
  runCount: 0,
  miles: 0,
  plannedMiles: 0,
  seconds: 0,
  longestRun: 0,
  elevationGain: 0,
});

/**
 * Running miles credited for a workout: what was logged, else what was planned.
 *
 * A slot that accepts either a run or a cross-training session can be filled by
 * a ride, and its distance must not be credited as running. Logs written before
 * sports were recorded carry no sport and were all runs.
 */
function loggedMiles(cell: CalendarCell, log: RunLog | undefined): number {
  if (!workoutTracksRunningMiles(cell.workout)) return 0;
  if (log?.sportType && !countsAsRunning(log.sportType)) return 0;
  if (typeof log?.miles === "number") return log.miles;
  if (cell.workout.type === "run-or-cross") return 0;
  return cell.workout.miles ?? 0;
}

function summarize(
  cells: CalendarCell[],
  logs: Record<string, RunLog>,
  runs: SyncedRun[],
  start: Date,
  end: Date,
  kind: ActivityKind
): PeriodStats {
  const stats = EMPTY(start, end);

  let hrMilesWeighted = 0;
  let hrMiles = 0;
  let cadenceSum = 0;
  let cadenceCount = 0;
  // Pace uses only time that covered distance. A 60-min pool session would
  // otherwise drag the average down without adding miles.
  let paceSeconds = 0;

  const today = startOfToday();

  for (const cell of cells) {
    if (cell.workout.type === "rest") continue;
    stats.scheduled += 1;
    if (cell.date <= today) stats.due += 1;
    if (workoutTracksRunningMiles(cell.workout)) {
      stats.plannedMiles += cell.workout.miles ?? 0;
    }

    const log = logs[cell.key];
    if (!log?.completed) continue;
    stats.completed += 1;

    /*
     * Running reads the schedule as well as the log, because a plan states the
     * miles. The other disciplines are scheduled by time, so their distance is
     * only ever what was actually recorded.
     */
    const miles =
      kind === "run" ? loggedMiles(cell, log) : log.miles ?? 0;
    const seconds = logSeconds(log);
    if (miles > 0) {
      stats.miles += miles;
      stats.runCount += 1;
      stats.longestRun = Math.max(stats.longestRun, miles);
      if (seconds) paceSeconds += seconds;
    }
    // "Time on feet" counts every completed session, distance or not.
    if (seconds) stats.seconds += seconds;

    if (log.avgHeartRate && miles > 0) {
      hrMilesWeighted += log.avgHeartRate * miles;
      hrMiles += miles;
    }
    if (log.maxHeartRate) {
      stats.maxHeartRate = Math.max(stats.maxHeartRate ?? 0, log.maxHeartRate);
    }
    if (log.elevationGain) stats.elevationGain += log.elevationGain;
    if (log.cadence) {
      cadenceSum += log.cadence;
      cadenceCount += 1;
    }
  }

  // Synced activities outside the plan count in every total, just not in the
  // scheduled/completed pair, which only makes sense for planned workouts.
  // Only running feeds the running numbers: a bike ride's distance and pace
  // are not comparable, so a ride contributes time on feet and max HR alone.
  for (const run of runs) {
    stats.seconds += run.seconds;
    if (run.maxHeartRate) {
      stats.maxHeartRate = Math.max(stats.maxHeartRate ?? 0, run.maxHeartRate);
    }
    if (activityKind(run.sportType) !== kind) continue;

    stats.runCount += 1;
    stats.miles += run.miles;
    stats.longestRun = Math.max(stats.longestRun, run.miles);
    paceSeconds += run.seconds;

    if (run.avgHeartRate) {
      hrMilesWeighted += run.avgHeartRate * run.miles;
      hrMiles += run.miles;
    }
    if (run.elevationGain) stats.elevationGain += run.elevationGain;
    if (run.cadence) {
      cadenceSum += run.cadence;
      cadenceCount += 1;
    }
  }

  stats.avgPace = paceSecondsPerMile(paceSeconds, stats.miles);
  if (hrMiles > 0) stats.avgHeartRate = Math.round(hrMilesWeighted / hrMiles);
  if (cadenceCount > 0) stats.avgCadence = Math.round(cadenceSum / cadenceCount);
  /*
   * Three decimals, not one. A tenth of a mile is 176 yards, which is a
   * nonsense quantum for a sport counted in hundreds of yards: rounding here
   * turned a 1,000 yard swim into 1,056. Display rounds to whatever the sport
   * reads in.
   */
  const round = (n: number) => Math.round(n * 1000) / 1000;
  stats.miles = round(stats.miles);
  stats.plannedMiles = round(stats.plannedMiles);
  stats.longestRun = round(stats.longestRun);
  stats.elevationGain = Math.round(stats.elevationGain);
  return stats;
}

function within(cells: CalendarCell[], start: Date, end: Date): CalendarCell[] {
  return cells.filter((c) => c.date >= start && c.date <= end);
}

function runsWithin(runs: SyncedRun[], start: Date, end: Date): SyncedRun[] {
  return runs.filter((r) => {
    const date = fromISO(r.date);
    return date >= start && date <= end;
  });
}

/** The window for a scope, anchored on today. */
function scopeWindow(
  scope: MetricScope,
  dates: Date[]
): { start: Date; end: Date } {
  const today = startOfToday();
  if (scope === "week") {
    const start = startOfCalendarWeek(today);
    return { start, end: addDays(start, 6) };
  }
  if (scope === "month") {
    const start = startOfMonth(today);
    return { start, end: addDays(startOfMonth(addDays(start, 32)), -1) };
  }
  return {
    start: dates[0],
    end: dates[dates.length - 1],
  };
}

function buildTrend(
  scope: MetricScope,
  cells: CalendarCell[],
  logs: Record<string, RunLog>,
  runs: SyncedRun[],
  window: { start: Date; end: Date },
  kind: ActivityKind
): TrendPoint[] {
  const inWindow = within(cells, window.start, window.end);
  // The trend plots distance and speed, so only the chosen sport belongs.
  const runsInWindow = runsWithin(runs, window.start, window.end).filter(
    (r) => activityKind(r.sportType) === kind
  );

  if (scope === "week") {
    // One point per completed run, in order, plan or not.
    return [
      ...inWindow
        .filter(
          (c) =>
            workoutTracksRunningMiles(c.workout) && logs[c.key]?.completed,
        )
        .map((cell) => {
          const log = logs[cell.key];
          const miles = loggedMiles(cell, log);
          return {
            date: cell.date,
            point: {
              label: cell.date.toLocaleDateString(undefined, {
                weekday: "short",
              }),
              miles: Math.round(miles * 10) / 10,
              pace: paceSecondsPerMile(logSeconds(log), miles),
              avgHeartRate: log?.avgHeartRate,
            },
          };
        }),
      ...runsInWindow.map((run) => {
        const date = fromISO(run.date);
        return {
          date,
          point: {
            label: date.toLocaleDateString(undefined, { weekday: "short" }),
            miles: Math.round(run.miles * 10) / 10,
            pace: paceSecondsPerMile(run.seconds, run.miles),
            avgHeartRate: run.avgHeartRate,
          },
        };
      }),
    ]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((entry) => entry.point);
  }

  // Weekly buckets across the window.
  const points: TrendPoint[] = [];
  for (
    let weekStart = startOfCalendarWeek(window.start);
    weekStart <= window.end;
    weekStart = addDays(weekStart, 7)
  ) {
    const weekEnd = addDays(weekStart, 6);
    const bucket = within(inWindow, weekStart, weekEnd);
    const bucketRuns = runsWithin(runsInWindow, weekStart, weekEnd);
    if (bucket.length === 0 && bucketRuns.length === 0) continue;
    const s = summarize(bucket, logs, bucketRuns, weekStart, weekEnd, kind);
    points.push({
      label: weekStart.toLocaleDateString(undefined, {
        month: "numeric",
        day: "numeric",
      }),
      miles: s.miles,
      pace: s.avgPace,
      avgHeartRate: s.avgHeartRate,
    });
  }
  return points;
}

export function computeInsights(
  plan: Plan,
  program: Program,
  scope: MetricScope,
  runs: SyncedRun[] = [],
  kind: ActivityKind = "run"
): Insights | null {
  const logs =
    plan.logs && typeof plan.logs === "object" && !Array.isArray(plan.logs)
      ? plan.logs
      : {};

  /*
   * Only the three sports a program can schedule read the plan. Walking and
   * everything else are measured purely from what was synced, since no plan
   * asks for them.
   */
  const sport = PROGRAM_SPORT[kind];
  const cells =
    sport && plan.startDate
      ? planCells(program, plan).filter((c) => workoutIncludes(c.workout, sport))
      : [];

  /*
   * An activity counted through a slot must not be counted again as a loose
   * one. Only the slots on this view count, so a ride that filled a
   * cross-training day still shows up in cycling's own totals.
   */
  const throughASlot = new Set<number>();
  for (const cell of cells) {
    const id = logs[cell.key]?.stravaActivityId;
    if (id !== undefined) throughASlot.add(id);
  }
  const extraRuns = runs.filter(
    (r) =>
      activityKind(r.sportType) === kind && !throughASlot.has(r.stravaActivityId)
  );
  if (cells.length === 0 && extraRuns.length === 0) return null;

  const dates = [
    ...cells.map((c) => c.date),
    ...extraRuns.map((r) => fromISO(r.date)),
  ].sort((a, b) => a.getTime() - b.getTime());

  const window = scopeWindow(scope, dates);
  const current = summarize(
    within(cells, window.start, window.end),
    logs,
    runsWithin(extraRuns, window.start, window.end),
    window.start,
    window.end,
    kind
  );

  let previous: PeriodStats | undefined;
  if (scope !== "plan") {
    const span =
      Math.round((window.end.getTime() - window.start.getTime()) / 86400000) + 1;
    const prevEnd = addDays(window.start, -1);
    const prevStart = addDays(prevEnd, -(span - 1));
    const prevCells = within(cells, prevStart, prevEnd);
    const prevRuns = runsWithin(extraRuns, prevStart, prevEnd);
    if (prevCells.length > 0 || prevRuns.length > 0) {
      previous = summarize(prevCells, logs, prevRuns, prevStart, prevEnd, kind);
    }
  }

  return {
    current,
    previous,
    trend: buildTrend(scope, cells, logs, extraRuns, window, kind),
  };
}

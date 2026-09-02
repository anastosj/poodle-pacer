import { ActivityKind, activityKind } from "@/lib/activities";
import { CalendarCell, planCells } from "@/lib/calendar";
import {
  addDays,
  addMonths,
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
import { runningMilesFor } from "@/lib/mileage";
import { paceSecondsPerMile } from "@/lib/pace";
import {
  Plan,
  RunLog,
  SyncedRun,
  effectiveStartDate,
  isPausedOn,
  logSeconds,
  raceDateOf,
} from "@/lib/store";

export type MetricScope = "week" | "month" | "6mo" | "plan";

export const SCOPE_LABELS: Record<MetricScope, string> = {
  week: "This week",
  month: "This month",
  "6mo": "6 months",
  plan: "Whole plan",
};

/** What the comparison window is called, for a "vs …" line under a tile. */
export const SCOPE_PREVIOUS_LABELS: Record<MetricScope, string> = {
  week: "last week",
  month: "last month",
  "6mo": "the 6 months before",
  plan: "the previous block",
};

export interface PeriodStats {
  start: Date;
  end: Date;
  /** Workouts marked done / scheduled in the window (rest days excluded). */
  completed: number;
  scheduled: number;
  /**
   * Scheduled workouts whose day has actually arrived, minus any the runner
   * stood the plan down for. Consistency measures against this rather than
   * `scheduled`, so neither tomorrow's run nor a week spent injured is counted
   * as one already missed.
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
  /**
   * The point's real date: the run's own day in "week" scope, the bucket's
   * Sunday otherwise. Carried so time-series charts can scale an axis by it
   * rather than treating `label` as an evenly spaced category.
   */
  date: Date;
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

function summarize(
  cells: CalendarCell[],
  logs: Record<string, RunLog>,
  runs: SyncedRun[],
  start: Date,
  end: Date,
  kind: ActivityKind,
  /** Days the runner stood down; they are neither owed nor missed. */
  paused: (iso: string) => boolean = () => false
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
    if (cell.date <= today && !paused(cell.iso)) stats.due += 1;
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
      kind === "run" ? runningMilesFor(cell.workout, log) : log.miles ?? 0;
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

/**
 * The window for a scope, anchored on today.
 *
 * "Whole plan" means the plan and nothing else: from the first day the runner
 * actually trains through to race day. It used to run from the earliest thing
 * in the account to the latest, which quietly turned it into "everything you
 * have ever synced" — years of history for anyone on their second plan, and
 * a number that could never be compared with the plan it was labelled with.
 * Only a plan with no dates at all falls back to the span of the data.
 */
function scopeWindow(
  scope: MetricScope,
  dates: Date[],
  plan: Plan,
  program: Program
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
  if (scope === "6mo") {
    // A rolling half year ending today: long enough to hold a whole training
    // block plus the base that led into it, and it does not care whether
    // there is a plan at all.
    return { start: addMonths(today, -6), end: today };
  }
  const startIso = effectiveStartDate(plan);
  const raceIso = raceDateOf(plan, program.weeks);
  if (startIso && raceIso) {
    return { start: fromISO(startIso), end: fromISO(raceIso) };
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
  kind: ActivityKind,
  paused: (iso: string) => boolean
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
          const miles = runningMilesFor(cell.workout, log);
          return {
            date: cell.date,
            point: {
              label: cell.date.toLocaleDateString(undefined, {
                weekday: "short",
              }),
              date: cell.date,
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
            date,
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
    const s = summarize(
      bucket,
      logs,
      bucketRuns,
      weekStart,
      weekEnd,
      kind,
      paused
    );
    points.push({
      label: weekStart.toLocaleDateString(undefined, {
        month: "numeric",
        day: "numeric",
      }),
      date: weekStart,
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

  const paused = (iso: string) => isPausedOn(plan, iso);

  const window = scopeWindow(scope, dates, plan, program);
  const current = summarize(
    within(cells, window.start, window.end),
    logs,
    runsWithin(extraRuns, window.start, window.end),
    window.start,
    window.end,
    kind,
    paused
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
      previous = summarize(
        prevCells,
        logs,
        prevRuns,
        prevStart,
        prevEnd,
        kind,
        paused
      );
    }
  }

  return {
    current,
    previous,
    trend: buildTrend(scope, cells, logs, extraRuns, window, kind, paused),
  };
}

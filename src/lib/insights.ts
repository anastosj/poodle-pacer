import { CalendarCell, planCells } from "@/lib/calendar";
import {
  addDays,
  startOfCalendarWeek,
  startOfMonth,
  startOfToday,
} from "@/lib/dates";
import { Program } from "@/lib/programs";
import { paceSecondsPerMile } from "@/lib/pace";
import { Plan, RunLog, logSeconds } from "@/lib/store";

export type MetricScope = "week" | "month" | "plan";

export const SCOPE_LABELS: Record<MetricScope, string> = {
  week: "This week",
  month: "This month",
  plan: "Whole plan",
};

export interface PeriodStats {
  start: Date;
  end: Date;
  /** Workouts marked done / scheduled (rest days excluded). */
  completed: number;
  scheduled: number;
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

const EMPTY = (start: Date, end: Date): PeriodStats => ({
  start,
  end,
  completed: 0,
  scheduled: 0,
  runCount: 0,
  miles: 0,
  plannedMiles: 0,
  seconds: 0,
  longestRun: 0,
  elevationGain: 0,
});

/** Miles credited for a workout: what was logged, else what was planned. */
function loggedMiles(cell: CalendarCell, log: RunLog | undefined): number {
  if (typeof log?.miles === "number") return log.miles;
  return cell.workout.type === "run" ? cell.workout.miles ?? 0 : 0;
}

function summarize(
  cells: CalendarCell[],
  logs: Record<string, RunLog>,
  start: Date,
  end: Date
): PeriodStats {
  const stats = EMPTY(start, end);

  let hrMilesWeighted = 0;
  let hrMiles = 0;
  let cadenceSum = 0;
  let cadenceCount = 0;
  // Pace uses only time that covered distance — a 60-min pool session would
  // otherwise drag the average down without adding miles.
  let paceSeconds = 0;

  for (const cell of cells) {
    if (cell.workout.type === "rest") continue;
    stats.scheduled += 1;
    if (cell.workout.type === "run") {
      stats.plannedMiles += cell.workout.miles ?? 0;
    }

    const log = logs[cell.key];
    if (!log?.completed) continue;
    stats.completed += 1;

    const miles = loggedMiles(cell, log);
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

  stats.avgPace = paceSecondsPerMile(paceSeconds, stats.miles);
  if (hrMiles > 0) stats.avgHeartRate = Math.round(hrMilesWeighted / hrMiles);
  if (cadenceCount > 0) stats.avgCadence = Math.round(cadenceSum / cadenceCount);
  stats.miles = Math.round(stats.miles * 10) / 10;
  stats.plannedMiles = Math.round(stats.plannedMiles * 10) / 10;
  stats.longestRun = Math.round(stats.longestRun * 10) / 10;
  stats.elevationGain = Math.round(stats.elevationGain);
  return stats;
}

function within(cells: CalendarCell[], start: Date, end: Date): CalendarCell[] {
  return cells.filter((c) => c.date >= start && c.date <= end);
}

/** The window for a scope, anchored on today. */
function scopeWindow(
  scope: MetricScope,
  cells: CalendarCell[]
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
    start: cells[0].date,
    end: cells[cells.length - 1].date,
  };
}

function buildTrend(
  scope: MetricScope,
  cells: CalendarCell[],
  logs: Record<string, RunLog>,
  window: { start: Date; end: Date }
): TrendPoint[] {
  const inWindow = within(cells, window.start, window.end);

  if (scope === "week") {
    // One point per completed run, in order.
    return inWindow
      .filter((c) => c.workout.type !== "rest" && logs[c.key]?.completed)
      .map((cell) => {
        const log = logs[cell.key];
        const miles = loggedMiles(cell, log);
        return {
          label: cell.date.toLocaleDateString(undefined, { weekday: "short" }),
          miles: Math.round(miles * 10) / 10,
          pace: paceSecondsPerMile(logSeconds(log), miles),
          avgHeartRate: log?.avgHeartRate,
        };
      });
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
    if (bucket.length === 0) continue;
    const s = summarize(bucket, logs, weekStart, weekEnd);
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
  scope: MetricScope
): Insights | null {
  if (!plan.startDate) return null;
  const cells = planCells(program, plan);
  if (cells.length === 0) return null;

  const window = scopeWindow(scope, cells);
  const current = summarize(
    within(cells, window.start, window.end),
    plan.logs,
    window.start,
    window.end
  );

  let previous: PeriodStats | undefined;
  if (scope !== "plan") {
    const span =
      Math.round((window.end.getTime() - window.start.getTime()) / 86400000) + 1;
    const prevEnd = addDays(window.start, -1);
    const prevStart = addDays(prevEnd, -(span - 1));
    const prevCells = within(cells, prevStart, prevEnd);
    if (prevCells.length > 0) {
      previous = summarize(prevCells, plan.logs, prevStart, prevEnd);
    }
  }

  return {
    current,
    previous,
    trend: buildTrend(scope, cells, plan.logs, window),
  };
}

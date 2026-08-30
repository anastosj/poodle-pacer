/**
 * Noticing that life happened, and offering to stand the plan down for it.
 *
 * A training plan is anchored to race day, so time away cannot be given back:
 * the weeks still fall where they fall. What the app can do is stop counting
 * them against the runner. `detectGap` finds a recent stretch that was simply
 * let go, and the runner turns it into a `PlanPause`, after which those days
 * are excluded from consistency, cannot break a streak, and read as paused
 * rather than missed.
 */
import { planCells } from "@/lib/calendar";
import { addDaysISO, startOfToday, toLocalISO } from "@/lib/dates";
import { Program } from "@/lib/programs";
import {
  Plan,
  SyncedRun,
  beginWeekOf,
  effectiveStartDate,
  isPausedOn,
} from "@/lib/store";

/**
 * How much has to be let go before offering to pause. Well past a skipped run
 * or a quiet long weekend — the card should read as recognition, not nagging.
 */
const MIN_GAP_DAYS = 6;
const MIN_MISSED_WORKOUTS = 3;

export interface Gap {
  /** Local ISO dates, inclusive. */
  fromIso: string;
  toIso: string;
  /** Whole days covered, both ends included. */
  days: number;
  /** Scheduled non-rest workouts inside it that were never logged. */
  missed: number;
  /**
   * True when nothing at all was logged before this gap, so the weeks ahead of
   * it are empty rather than earned. Only then can the plan's begin week move
   * up to meet today without deleting real training.
   */
  fromPlanStart: boolean;
}

/**
 * The stretch of let-go days running back from yesterday.
 *
 * Today is never part of it: its workout is not missed until the day is over.
 * The walk stops at the first day carrying any activity, at the plan's first
 * training day, or at an existing pause — a gap butting onto one is that
 * pause growing, and `addPause` folds the two together.
 */
export function detectGap(
  plan: Plan,
  program: Program,
  runs: SyncedRun[] = [],
  today: Date = startOfToday()
): Gap | null {
  const start = effectiveStartDate(plan);
  if (!start) return null;

  const todayIso = toLocalISO(today);
  const cells = planCells(program, plan);
  if (cells.length === 0) return null;

  // Everything that would count as having shown up on a given date.
  const workedOut = new Set<string>();
  for (const cell of cells) {
    if (plan.logs[cell.key]?.completed) workedOut.add(cell.iso);
  }
  for (const run of runs) workedOut.add(run.date);

  const scheduled = new Map(
    cells
      .filter((cell) => cell.workout.type !== "rest")
      .map((cell) => [cell.iso, cell])
  );
  const lastPlanDay = cells[cells.length - 1].iso;

  let missed = 0;
  let days = 0;
  let fromIso = todayIso;
  const toIso = addDaysISO(todayIso, -1);
  if (toIso < start) return null;

  for (let iso = toIso; iso >= start; iso = addDaysISO(iso, -1)) {
    // Days after the race are not the plan's to judge.
    if (iso > lastPlanDay) continue;
    if (workedOut.has(iso) || isPausedOn(plan, iso)) break;
    days += 1;
    fromIso = iso;
    if (scheduled.has(iso)) missed += 1;
  }

  if (days < MIN_GAP_DAYS || missed < MIN_MISSED_WORKOUTS) return null;

  return {
    fromIso,
    toIso,
    days,
    missed,
    fromPlanStart: fromIso === start && !hasAnyLog(plan),
  };
}

function hasAnyLog(plan: Plan): boolean {
  return Object.values(plan.logs).some((log) => log.completed);
}

/**
 * The program week covering a date, or undefined when it falls outside.
 * Used to move a never-started plan's begin week up to meet today, which is
 * the one case where dropping weeks costs the runner nothing.
 */
export function programWeekOn(
  plan: Plan,
  program: Program,
  iso: string
): number | undefined {
  return planCells(program, plan).find((cell) => cell.iso === iso)?.week;
}

/**
 * Standing down a gap that covers everything trained so far is really a late
 * start: there is no history to keep, so the plan may as well begin at the
 * week that covers today and taper properly from there.
 */
export function rejoinWeekFor(
  gap: Gap,
  plan: Plan,
  program: Program,
  today: Date = startOfToday()
): number | undefined {
  if (!gap.fromPlanStart) return undefined;
  const week = programWeekOn(plan, program, toLocalISO(today));
  if (week === undefined || week <= beginWeekOf(plan)) return undefined;
  return week;
}

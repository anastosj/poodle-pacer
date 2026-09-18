/**
 * Matching an activity to a workout by hand.
 *
 * The automatic matcher in `sync` files an activity by when it was done and
 * how far it went, which is a guess — a good one on a tidy week, and wrong
 * often enough that the runner has to be able to say otherwise. Everything
 * here exists to put a short, readable list of candidates in front of them:
 * the activities near a workout, or the workouts near an activity.
 */
import { CalendarCell } from "@/lib/calendar";
import { daysBetween, fromISO } from "@/lib/dates";
import { Plan, RunLog, SyncedRun } from "@/lib/store";

/**
 * How far either side of a day the picker looks, in days.
 *
 * Wider than the three days the automatic matcher will reach on its own: that
 * window is a judgement about how late a session can be and still be the one
 * that was planned, and this one is not judging anything. The runner already
 * knows which session it was; the only job left is to keep the list short
 * enough to read at a glance.
 */
export const MATCH_REACH_DAYS = 10;

/** As many choices as a menu can show before it becomes a list to scroll. */
const MAX_CHOICES = 12;

/** Whole days between two ISO dates, however the clocks moved in between. */
function gapBetween(a: string, b: string): number {
  return Math.abs(daysBetween(fromISO(a), fromISO(b)));
}

/**
 * Activities a workout could plausibly be, nearest day first.
 *
 * `runs` is the loose log — whatever has no slot of its own — so the list is
 * only ever activities that are currently going spare.
 */
export function activityChoicesFor(
  iso: string,
  runs: SyncedRun[]
): SyncedRun[] {
  return runs
    .map((run) => ({ run, gap: gapBetween(iso, run.date) }))
    .filter(({ gap }) => gap <= MATCH_REACH_DAYS)
    .sort((a, b) => a.gap - b.gap || a.run.date.localeCompare(b.run.date))
    .slice(0, MAX_CHOICES)
    .map(({ run }) => run);
}

/** A workout an activity could be credited to. */
export interface SlotChoice {
  cell: CalendarCell;
  /**
   * The activity already filling this workout, if there is one. Named rather
   * than hidden: taking a slot from something else is a fair thing to want,
   * and an unfair thing to do silently.
   */
  takenBy?: string;
  /** Ticked off by hand, so matching to it fills in the numbers. */
  markedDone: boolean;
}

/**
 * Workouts an activity could be credited to, nearest day first.
 *
 * Rest days are left out: a slot the plan asks nothing of has no tally to join
 * and reads as rest wherever it is drawn, so an activity filed into one simply
 * disappears from every total in the app. Race day stays in — running your
 * race and wanting it on race day is not something to be protected from.
 */
export function slotChoicesFor(
  iso: string,
  cells: CalendarCell[],
  plan: Plan
): SlotChoice[] {
  return cells
    .filter((cell) => cell.workout.type !== "rest")
    .map((cell) => ({ cell, gap: gapBetween(iso, cell.iso) }))
    .filter(({ gap }) => gap <= MATCH_REACH_DAYS)
    .sort((a, b) => a.gap - b.gap || a.cell.iso.localeCompare(b.cell.iso))
    .slice(0, MAX_CHOICES)
    .map(({ cell }) => {
      const log: RunLog | undefined = plan.logs[cell.key];
      return {
        cell,
        ...(log?.stravaActivityId !== undefined
          ? { takenBy: log.stravaName ?? "a synced activity" }
          : {}),
        markedDone: Boolean(log?.completed) && log?.stravaActivityId === undefined,
      };
    });
}

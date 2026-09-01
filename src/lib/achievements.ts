/**
 * Poodle-worthy achievements, derived on the fly from logged runs, so there's
 * nothing to store and nothing to get out of sync.
 *
 * Speed badges use a run's average pace projected over the badge distance, so
 * a run only counts when it's at least that long. Streaks count consecutive
 * training-plan days where nothing was missed: scheduled workouts done, rest
 * days rested. Today only joins the streak once its workout is logged.
 */
import { countsAsRunning } from "@/lib/activities";
import { isRunningEffort } from "@/lib/mileage";
import { planCells } from "@/lib/calendar";
import { startOfToday, toLocalISO } from "@/lib/dates";
import { Program, programs } from "@/lib/programs";
import { formatDuration } from "@/lib/pace";
import {
  Plan,
  RunnerState,
  activePlan,
  isPausedOn,
  logSeconds,
} from "@/lib/store";

export interface Achievement {
  id: string;
  title: string;
  kind: "speed" | "streak";
  unlocked: boolean;
  /** Unlocked: the earned value ("23:41"). Locked: what it takes. */
  detail: string;
  /**
   * The single run that earned it. Speed badges have one; a streak is earned
   * over many days, so it carries `span` instead.
   */
  earnedBy?: EarnedBy;
  /** The days a streak ran across, first to last. */
  span?: { fromIso: string; toIso: string };
}

/**
 * Enough to date an achievement and, when there is one, open the run behind it.
 *
 * A run in the plan is addressed by its slot. A synced activity outside the
 * plan has no slot, so it carries its Strava id instead and the badge is dated
 * but inert, like one whose run has since been deleted.
 */
export interface EarnedBy {
  planId?: string;
  /** Key into `plan.logs`. */
  logKey?: string;
  /** Set instead of the pair above when the run came from the synced log. */
  stravaActivityId?: number;
  /** Local ISO date of the run. */
  iso: string;
  /** The workout's label, for the detail view's heading. */
  label: string;
}

const MILE = 1;
const FIVE_K_MILES = 3.10686;
const TEN_K_MILES = 6.21371;

interface SpeedTarget {
  id: string;
  title: string;
  miles: number;
  lockedDetail: string;
}

const SPEED_TARGETS: SpeedTarget[] = [
  { id: "fastest-mile", title: "Fastest mile", miles: MILE, lockedDetail: "Log a run of 1+ mi with a time" },
  { id: "fastest-5k", title: "Fastest 5K", miles: FIVE_K_MILES, lockedDetail: "Log a run of 3.1+ mi with a time" },
  { id: "fastest-10k", title: "Fastest 10K", miles: TEN_K_MILES, lockedDetail: "Log a run of 6.2+ mi with a time" },
];

const STREAK_TARGETS: { id: string; title: string; days: number }[] = [
  { id: "streak-5", title: "5-day streak", days: 5 },
  { id: "streak-10", title: "10-day streak", days: 10 },
  { id: "streak-25", title: "25-day streak", days: 25 },
  { id: "streak-month", title: "1-month streak", days: 30 },
  { id: "streak-50", title: "50-day streak", days: 50 },
];

/**
 * Best average-pace time over `targetMiles`, and the run that set it.
 *
 * Walks the calendar rather than the logs directly, because a badge has to say
 * when it happened and a bare log key carries no date.
 *
 * Synced activities outside the plan count too, but only running ones: a bike
 * ride covers ten miles far faster than any run, and is not a PR. They carry no
 * plan slot, so their badge is dated but has nothing to open, the same way a
 * badge whose run was later deleted goes inert.
 */
function bestEffort(
  state: RunnerState,
  targetMiles: number
): { seconds: number; earnedBy: EarnedBy } | null {
  let best: { seconds: number; earnedBy: EarnedBy } | null = null;

  const consider = (seconds: number, earnedBy: EarnedBy) => {
    if (best === null || seconds < best.seconds) best = { seconds, earnedBy };
  };

  for (const plan of state.plans) {
    const program =
      programs.find((p) => p.id === plan.programId) ?? programs[0];
    for (const cell of planCells(program, plan)) {
      const log = plan.logs[cell.key];
      // Same rule as the loose activities below: only running sets a running
      // record, whatever slot of the plan the effort happened to fill.
      if (!isRunningEffort(log) || !log?.miles || log.miles < targetMiles) {
        continue;
      }
      const seconds = logSeconds(log);
      if (!seconds) continue;
      consider((seconds / log.miles) * targetMiles, {
        planId: plan.id,
        logKey: cell.key,
        // The day the effort actually happened, which is not the slot's own
        // day when the run was matched back from elsewhere in the week.
        iso: log.loggedDate ?? cell.iso,
        label: log.stravaName ?? cell.workout.label,
      });
    }
  }

  for (const run of state.runs ?? []) {
    if (!countsAsRunning(run.sportType)) continue;
    if (!run.miles || run.miles < targetMiles || !run.seconds) continue;
    consider((run.seconds / run.miles) * targetMiles, {
      stravaActivityId: run.stravaActivityId,
      iso: run.date,
      label: run.name ?? "Synced run",
    });
  }

  return best;
}

/**
 * The longest run of consecutive plan days kept, up through today. A day is
 * kept when its scheduled workout is completed (rest days are free); today
 * doesn't break a streak until it's missed, it just doesn't extend it yet.
 *
 * A stood-down day carrying an unmet workout is stepped over: an injury joins
 * the days either side rather than breaking them apart. Rest days inside the
 * pause still count, exactly as they did before it was marked — they were
 * never failures, and skipping them too would mean marking a pause could
 * *lower* the streak, which is precisely backwards.
 */
function walkStreak(
  plan: Plan,
  program: Program
): { best: number; days: { length: number; fromIso: string; toIso: string }[] } {
  const todayIso = toLocalISO(startOfToday());
  const days: { length: number; fromIso: string; toIso: string }[] = [];
  let best = 0;
  let current = 0;
  let hasWorkout = false; // an all-rest run of days isn't a streak
  let fromIso = "";

  for (const cell of planCells(program, plan)) {
    if (cell.iso > todayIso) break;
    const done = plan.logs[cell.key]?.completed ?? false;
    if (!done && cell.workout.type !== "rest" && isPausedOn(plan, cell.iso)) {
      continue;
    }
    const kept = cell.workout.type === "rest" || done;
    if (kept) {
      if (current === 0) fromIso = cell.iso;
      current += 1;
      if (done) hasWorkout = true;
      if (hasWorkout) {
        best = Math.max(best, current);
        days.push({ length: current, fromIso, toIso: cell.iso });
      }
    } else if (cell.iso === todayIso) {
      break; // the day isn't over; don't count it either way
    } else {
      current = 0;
      hasWorkout = false;
    }
  }
  return { best, days };
}

export function bestStreak(plan: Plan, program: Program): number {
  return walkStreak(plan, program).best;
}

export function computeAchievements(state: RunnerState): Achievement[] {
  const plan = activePlan(state);
  const program = programs.find((p) => p.id === plan.programId) ?? programs[0];

  const speed: Achievement[] = SPEED_TARGETS.map((t) => {
    const best = bestEffort(state, t.miles);
    return {
      id: t.id,
      title: t.title,
      kind: "speed",
      unlocked: best !== null,
      detail: best ? formatDuration(Math.round(best.seconds)) : t.lockedDetail,
      earnedBy: best?.earnedBy,
    };
  });

  const { best: streak, days } = walkStreak(plan, program);
  const streaks: Achievement[] = STREAK_TARGETS.map((t) => ({
    id: t.id,
    title: t.title,
    kind: "streak",
    unlocked: streak >= t.days,
    detail:
      streak >= t.days
        ? `Best: ${streak} days`
        : `${streak} of ${t.days} days`,
    // A streak is earned across days, not by one run, so it gets the range it
    // ran over and nothing to click through to.
    span: days.find((d) => d.length === t.days),
  }));

  return [...speed, ...streaks];
}

/**
 * Poodle-worthy achievements, derived on the fly from logged runs, so there's
 * nothing to store and nothing to get out of sync.
 *
 * Speed badges use a run's average pace projected over the badge distance, so
 * a run only counts when it's at least that long. Streaks count consecutive
 * training-plan days where nothing was missed: scheduled workouts done, rest
 * days rested. Today only joins the streak once its workout is logged.
 */
import { planCells } from "@/lib/calendar";
import { startOfToday, toLocalISO } from "@/lib/dates";
import { Program, programs } from "@/lib/programs";
import { formatDuration } from "@/lib/pace";
import { Plan, RunnerState, activePlan, logSeconds } from "@/lib/store";

export interface Achievement {
  id: string;
  title: string;
  kind: "speed" | "streak";
  unlocked: boolean;
  /** Unlocked: the earned value ("23:41"). Locked: what it takes. */
  detail: string;
  /** The run that earned it, so a badge can point at the day it happened. */
  earnedBy?: EarnedBy;
}

/** Enough to date an achievement and open the run behind it. */
export interface EarnedBy {
  planId: string;
  /** Key into `plan.logs`. */
  logKey: string;
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
 */
function bestEffort(
  plans: Plan[],
  targetMiles: number
): { seconds: number; earnedBy: EarnedBy } | null {
  let best: { seconds: number; earnedBy: EarnedBy } | null = null;
  for (const plan of plans) {
    const program =
      programs.find((p) => p.id === plan.programId) ?? programs[0];
    for (const cell of planCells(program, plan)) {
      const log = plan.logs[cell.key];
      if (!log?.completed || !log.miles || log.miles < targetMiles) continue;
      const seconds = logSeconds(log);
      if (!seconds) continue;
      const projected = (seconds / log.miles) * targetMiles;
      if (best === null || projected < best.seconds) {
        best = {
          seconds: projected,
          earnedBy: {
            planId: plan.id,
            logKey: cell.key,
            iso: cell.iso,
            label: log.stravaName ?? cell.workout.label,
          },
        };
      }
    }
  }
  return best;
}

/**
 * The longest run of consecutive plan days kept, up through today. A day is
 * kept when its scheduled workout is completed (rest days are free); today
 * doesn't break a streak until it's missed, it just doesn't extend it yet.
 */
function walkStreak(
  plan: Plan,
  program: Program
): { best: number; days: { length: number; earnedBy: EarnedBy }[] } {
  const todayIso = toLocalISO(startOfToday());
  const days: { length: number; earnedBy: EarnedBy }[] = [];
  let best = 0;
  let current = 0;
  let hasWorkout = false; // an all-rest run of days isn't a streak

  for (const cell of planCells(program, plan)) {
    if (cell.iso > todayIso) break;
    const log = plan.logs[cell.key];
    const done = log?.completed ?? false;
    const kept = cell.workout.type === "rest" || done;
    if (kept) {
      current += 1;
      if (done) hasWorkout = true;
      if (hasWorkout) {
        best = Math.max(best, current);
        days.push({
          length: current,
          earnedBy: {
            planId: plan.id,
            logKey: cell.key,
            iso: cell.iso,
            label: log?.stravaName ?? cell.workout.label,
          },
        });
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
    const best = bestEffort(state.plans, t.miles);
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
    // The day the streak first reached this length: a streak has no single run
    // behind it, but the day it got there is the one worth linking to.
    earnedBy: days.find((d) => d.length === t.days)?.earnedBy,
  }));

  return [...speed, ...streaks];
}

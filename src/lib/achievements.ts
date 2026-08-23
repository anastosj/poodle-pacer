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

/** Best average-pace time over `targetMiles`, from any plan's logged runs. */
function bestEffortSeconds(plans: Plan[], targetMiles: number): number | null {
  let best: number | null = null;
  for (const plan of plans) {
    for (const log of Object.values(plan.logs)) {
      if (!log.completed || !log.miles || log.miles < targetMiles) continue;
      const seconds = logSeconds(log);
      if (!seconds) continue;
      const projected = (seconds / log.miles) * targetMiles;
      if (best === null || projected < best) best = projected;
    }
  }
  return best;
}

/**
 * The longest run of consecutive plan days kept, up through today. A day is
 * kept when its scheduled workout is completed (rest days are free); today
 * doesn't break a streak until it's missed, it just doesn't extend it yet.
 */
export function bestStreak(plan: Plan, program: Program): number {
  const todayIso = toLocalISO(startOfToday());
  let best = 0;
  let current = 0;
  let hasWorkout = false; // an all-rest run of days isn't a streak

  for (const cell of planCells(program, plan)) {
    if (cell.iso > todayIso) break;
    const done = plan.logs[cell.key]?.completed ?? false;
    const kept = cell.workout.type === "rest" || done;
    if (kept) {
      current += 1;
      if (done) hasWorkout = true;
      if (hasWorkout) best = Math.max(best, current);
    } else if (cell.iso === todayIso) {
      break; // the day isn't over; don't count it either way
    } else {
      current = 0;
      hasWorkout = false;
    }
  }
  return best;
}

export function computeAchievements(state: RunnerState): Achievement[] {
  const plan = activePlan(state);
  const program = programs.find((p) => p.id === plan.programId) ?? programs[0];

  const speed: Achievement[] = SPEED_TARGETS.map((t) => {
    const seconds = bestEffortSeconds(state.plans, t.miles);
    return {
      id: t.id,
      title: t.title,
      kind: "speed",
      unlocked: seconds !== null,
      detail:
        seconds !== null ? formatDuration(Math.round(seconds)) : t.lockedDetail,
    };
  });

  const streak = bestStreak(plan, program);
  const streaks: Achievement[] = STREAK_TARGETS.map((t) => ({
    id: t.id,
    title: t.title,
    kind: "streak",
    unlocked: streak >= t.days,
    detail:
      streak >= t.days
        ? `Best: ${streak} days`
        : `${streak} of ${t.days} days`,
  }));

  return [...speed, ...streaks];
}

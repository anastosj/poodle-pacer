import { listRaceMembersWithState, UserRecord } from "@/lib/db";
import { fromISO, startOfToday } from "@/lib/dates";
import { computeInsights, consistencyOf } from "@/lib/insights";
import { Program, programs } from "@/lib/programs";
import {
  Plan,
  RunnerState,
  normalizeState,
  programForPlan,
} from "@/lib/store";

export interface RunnerSummary {
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** Null until they've set a race date, when they show as "getting started". */
  raceName: string | null;
  raceDate: string | null;
  daysToRace: number | null;
  currentWeek: number | null;
  totalWeeks: number;
  /** Whole-plan totals. */
  completed: number;
  scheduled: number;
  /** Workouts whose day has arrived, the denominator for consistency. */
  due: number;
  miles: number;
  plannedMiles: number;
  longestRun: number;
  /** This calendar week, the number people actually care about day to day. */
  weekMiles: number;
  weekCompleted: number;
  weekScheduled: number;
  /** Workouts due so far this week. Zero early on, before anything is owed. */
  weekDue: number;
  /**
   * Completed over due for this calendar week, and the only thing the pack
   * ranks on. A whole-plan ratio carries one rough week forward for months;
   * this one resets every Monday, so a bad week costs a week and not a season.
   */
  weekConsistency: number;
  started: boolean;
  followingAlong: boolean;
}

function programFor(plan: Plan): Program {
  return programForPlan(
    programs.find((p) => p.id === plan.programId) ?? programs[0],
    plan
  );
}

function placeholder(user: UserRecord): RunnerSummary {
  return {
    userId: user.id,
    name: user.name ?? "Runner",
    avatarUrl: user.avatarUrl,
    raceName: null,
    raceDate: null,
    daysToRace: null,
    currentWeek: null,
    totalWeeks: 0,
    completed: 0,
    scheduled: 0,
    due: 0,
    miles: 0,
    plannedMiles: 0,
    longestRun: 0,
    weekMiles: 0,
    weekCompleted: 0,
    weekScheduled: 0,
    weekDue: 0,
    weekConsistency: 0,
    started: false,
    followingAlong: false,
  };
}

function summarize(user: UserRecord, raw: unknown, planId: string): RunnerSummary {
  const state: RunnerState = normalizeState(raw);
  const plan = state.plans.find((p) => p.id === planId);
  if (!plan) return placeholder(user);
  const program = programFor(plan);

  const base: RunnerSummary = {
    userId: user.id,
    name: user.name ?? "Runner",
    avatarUrl: user.avatarUrl,
    raceName: plan.name || null,
    raceDate: null,
    daysToRace: null,
    currentWeek: null,
    totalWeeks: program.weeks,
    completed: 0,
    scheduled: 0,
    due: 0,
    miles: 0,
    plannedMiles: 0,
    longestRun: 0,
    weekMiles: 0,
    weekCompleted: 0,
    weekScheduled: 0,
    weekDue: 0,
    weekConsistency: 0,
    started: Boolean(plan.startDate),
    followingAlong: false,
  };

  if (!plan.startDate) return base;

  const whole = computeInsights(plan, program, "plan");
  const week = computeInsights(plan, program, "week");
  if (!whole) return base;

  const today = startOfToday();
  const start = fromISO(plan.startDate);
  if (Number.isNaN(start.getTime())) return base;
  const raceDate = whole.current.end;
  if (Number.isNaN(raceDate.getTime())) return base;
  const dayDiff = Math.floor(
    (today.getTime() - start.getTime()) / 86400000
  );
  const currentWeek =
    dayDiff < 0 ? null : Math.min(Math.floor(dayDiff / 7) + 1, program.weeks);

  return {
    ...base,
    raceDate: raceDate.toISOString().slice(0, 10),
    daysToRace: Math.max(
      0,
      Math.ceil((raceDate.getTime() - today.getTime()) / 86400000)
    ),
    currentWeek,
    completed: whole.current.completed,
    scheduled: whole.current.scheduled,
    due: whole.current.due,
    miles: whole.current.miles,
    plannedMiles: whole.current.plannedMiles,
    longestRun: whole.current.longestRun,
    weekMiles: week?.current.miles ?? 0,
    weekCompleted: week?.current.completed ?? 0,
    weekScheduled: week?.current.scheduled ?? 0,
    weekDue: week?.current.due ?? 0,
    weekConsistency: week ? consistencyOf(week.current) : 0,
  };
}

/**
 * A race's progress, ranked on this week's consistency alone. Returns null for
 * non-members so callers can use the same not-found response for missing and
 * private races.
 */
export async function raceLeaderboard(
  raceId: string,
  requesterUserId: string
): Promise<RunnerSummary[] | null> {
  const rows = await listRaceMembersWithState(raceId, requesterUserId);
  if (!rows) return null;
  return rows
    .map(({ user, state, planId, shareStats }) => {
      if (!shareStats) return { ...placeholder(user), followingAlong: true };
      try {
        return summarize(user, state, planId);
      } catch (error) {
        console.error("Failed to summarize group runner", user.id, error);
        return placeholder(user);
      }
    })
    .sort((a, b) => {
      if (a.started !== b.started) return a.started ? -1 : 1;
      if (b.weekConsistency !== a.weekConsistency) {
        return b.weekConsistency - a.weekConsistency;
      }
      return b.weekMiles - a.weekMiles;
    });
}

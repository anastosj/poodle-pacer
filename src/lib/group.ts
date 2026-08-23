import { UserRecord, listUsersWithState } from "@/lib/db";
import { fromISO, startOfToday } from "@/lib/dates";
import { computeInsights } from "@/lib/insights";
import { Program, programs } from "@/lib/programs";
import { Plan, RunnerState, activePlan, normalizeState } from "@/lib/store";

export interface RunnerSummary {
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** Null until they've set a race date — they show as "getting started". */
  raceName: string | null;
  raceDate: string | null;
  daysToRace: number | null;
  currentWeek: number | null;
  totalWeeks: number;
  /** Whole-plan totals. */
  completed: number;
  scheduled: number;
  consistency: number;
  miles: number;
  plannedMiles: number;
  avgPace?: number;
  longestRun: number;
  /** This calendar week, the number people actually care about day to day. */
  weekMiles: number;
  weekCompleted: number;
  weekScheduled: number;
  started: boolean;
}

function programFor(plan: Plan): Program {
  return programs.find((p) => p.id === plan.programId) ?? programs[0];
}

function summarize(user: UserRecord, raw: unknown): RunnerSummary {
  const state: RunnerState = normalizeState(raw);
  const plan = activePlan(state);
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
    consistency: 0,
    miles: 0,
    plannedMiles: 0,
    longestRun: 0,
    weekMiles: 0,
    weekCompleted: 0,
    weekScheduled: 0,
    started: Boolean(plan.startDate),
  };

  if (!plan.startDate) return base;

  const whole = computeInsights(plan, program, "plan");
  const week = computeInsights(plan, program, "week");
  if (!whole) return base;

  const today = startOfToday();
  const start = fromISO(plan.startDate);
  const raceDate = whole.current.end;
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
    consistency:
      whole.current.scheduled > 0
        ? whole.current.completed / whole.current.scheduled
        : 0,
    miles: whole.current.miles,
    plannedMiles: whole.current.plannedMiles,
    avgPace: whole.current.avgPace,
    longestRun: whole.current.longestRun,
    weekMiles: week?.current.miles ?? 0,
    weekCompleted: week?.current.completed ?? 0,
    weekScheduled: week?.current.scheduled ?? 0,
  };
}

/**
 * Everyone's progress, most consistent first — a friendlier ranking than raw
 * mileage, since plans differ in length and people start at different times.
 * Runners who haven't set a race date sort last.
 */
export async function groupSummaries(): Promise<RunnerSummary[]> {
  const rows = await listUsersWithState();
  return rows
    .map(({ user, state }) => summarize(user, state))
    .sort((a, b) => {
      if (a.started !== b.started) return a.started ? -1 : 1;
      if (b.consistency !== a.consistency) return b.consistency - a.consistency;
      return b.miles - a.miles;
    });
}

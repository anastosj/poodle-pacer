// Plain types and pure helpers, shared by client components and server code
// (the group view summarizes every runner's plan on the server). The
// localStorage helpers below guard on `typeof window`, so this is import-safe
// from either side.
import { addDaysISO, daysBetween, fromISO, startOfToday } from "@/lib/dates";

export type Feel = "good" | "medium" | "bad";

export interface RunLog {
  completed: boolean;
  miles?: number;
  /** Legacy whole-minute duration. Superseded by `seconds`, read via `logSeconds`. */
  minutes?: number;
  /** Precise duration in seconds, so pace is accurate. */
  seconds?: number;
  note?: string;
  feel?: Feel;
  stravaActivityId?: number;
  stravaName?: string;
  /** Metrics pulled from Strava (typically originating on an Apple Watch). */
  avgHeartRate?: number;
  maxHeartRate?: number;
  /** Elevation gain in feet. */
  elevationGain?: number;
  /** Steps per minute (Strava reports one leg; we double it on import). */
  cadence?: number;
  /**
   * Splits and route baked into the log itself, written only by the demo
   * seeder. Real runs fetch this from Strava on demand, but demo accounts have
   * no Strava connection, so without it the detail sheet cannot be seen at all.
   */
  sampleDetail?: {
    splits: {
      mile: number;
      miles: number;
      seconds: number;
      pace: number;
      elevationChange: number;
      heartRate?: number;
    }[];
    polyline: string;
  };
}

/** Duration of a logged run in seconds, tolerating the legacy `minutes` field. */
export function logSeconds(log: RunLog | undefined): number | undefined {
  if (!log) return undefined;
  if (typeof log.seconds === "number" && log.seconds > 0) return log.seconds;
  if (typeof log.minutes === "number" && log.minutes > 0) return log.minutes * 60;
  return undefined;
}

export interface Plan {
  id: string;
  name: string;
  programId: string;
  /** ISO date of program week 1, day 0 (Monday). May sit in the past. */
  startDate?: string;
  /**
   * First program week the runner actually trains. Greater than 1 when the
   * race is closer than the full program length, so they join partway in and
   * work backwards from race day rather than starting with weeks of misses.
   */
  beginWeek?: number;
  logs: Record<string, RunLog>; // key: `${week}-${dayIndex}`
}

export interface AlertSettings {
  phone: string;
  time: string; // HH:MM
  enabled: boolean;
  /** IANA timezone the alert time is interpreted in, e.g. America/New_York. */
  timezone?: string;
  /**
   * The exact number a confirmation text last reached. Compared against
   * `phone` so editing the number visibly drops it back to unconfirmed.
   */
  confirmedPhone?: string;
}

export interface RunnerState {
  plans: Plan[];
  activePlanId: string;
  alerts: AlertSettings;
  onboarded?: boolean;
}

export function newPlanId() {
  return `plan-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function makePlan(name: string): Plan {
  return {
    id: newPlanId(),
    name,
    programId: "hal-higdon-half-novice-1",
    logs: {},
  };
}

export function defaultState(): RunnerState {
  const plan = makePlan("My Half Marathon");
  return {
    plans: [plan],
    activePlanId: plan.id,
    alerts: { phone: "", time: "07:00", enabled: false },
  };
}

interface LegacyState {
  programId?: string;
  startDate?: string;
  logs?: Record<string, RunLog>;
}

function migrate(raw: LegacyState & Partial<RunnerState>): RunnerState {
  if (Array.isArray(raw.plans) && raw.plans.length > 0) {
    return {
      plans: raw.plans,
      activePlanId:
        raw.activePlanId && raw.plans.some((p) => p.id === raw.activePlanId)
          ? raw.activePlanId
          : raw.plans[0].id,
      alerts: raw.alerts ?? { phone: "", time: "07:00", enabled: false },
      onboarded: raw.onboarded,
    };
  }
  const plan: Plan = {
    ...makePlan("My Half Marathon"),
    programId: raw.programId ?? "hal-higdon-half-novice-1",
    startDate: raw.startDate,
    logs: raw.logs ?? {},
  };
  return {
    plans: [plan],
    activePlanId: plan.id,
    alerts: { phone: "", time: "07:00", enabled: false },
  };
}

/** Normalize state loaded from any source (server or localStorage). */
export function normalizeState(raw: unknown): RunnerState {
  if (!raw || typeof raw !== "object") return defaultState();
  try {
    return migrate(raw as LegacyState & Partial<RunnerState>);
  } catch {
    return defaultState();
  }
}

/** Cache key is per user id, so two accounts on one device stay separate. */
function storageKey(userId: string) {
  return `poodle-pacer:${userId}`;
}

export function loadState(userId: string): RunnerState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function saveState(userId: string, state: RunnerState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
}

export function activePlan(state: RunnerState): Plan {
  return state.plans.find((p) => p.id === state.activePlanId) ?? state.plans[0];
}

export function updateActivePlan(
  state: RunnerState,
  updater: (plan: Plan) => Plan
): RunnerState {
  return {
    ...state,
    plans: state.plans.map((p) =>
      p.id === state.activePlanId ? updater(p) : p
    ),
  };
}

export function logKey(week: number, dayIndex: number) {
  return `${week}-${dayIndex}`;
}

/** Race day is the last day (Sunday) of the final week. */
export function raceDateFromStart(startDate: string, weeks: number): string {
  return addDaysISO(startDate, weeks * 7 - 1);
}

export function startDateFromRace(raceDate: string, weeks: number): string {
  return addDaysISO(raceDate, -(weeks * 7 - 1));
}

/** The first program week this runner trains. */
export function beginWeekOf(plan: Plan): number {
  return Math.max(1, plan.beginWeek ?? 1);
}

/** The date training actually begins, accounting for a mid-program join. */
export function effectiveStartDate(plan: Plan): string | undefined {
  if (!plan.startDate) return undefined;
  return addDaysISO(plan.startDate, (beginWeekOf(plan) - 1) * 7);
}

/**
 * Anchor a plan to race day. If the full program no longer fits before the
 * race, begin at the week that covers today and taper from there. Picking a
 * race four weeks out should start you at week 9 of 12, not bury you under
 * eight weeks of missed workouts.
 */
export function planFromRaceDate(
  raceDate: string,
  weeks: number,
  today: Date = startOfToday()
): { startDate: string; beginWeek: number } {
  const startDate = startDateFromRace(raceDate, weeks);
  const elapsed = daysBetween(fromISO(startDate), today);
  const beginWeek =
    elapsed <= 0 ? 1 : Math.min(Math.floor(elapsed / 7) + 1, weeks);
  return { startDate, beginWeek };
}

/** Whole days until training begins. Zero once it has started. */
export function daysUntilStart(
  plan: Plan,
  today: Date = startOfToday()
): number {
  const start = effectiveStartDate(plan);
  if (!start) return 0;
  return Math.max(0, daysBetween(today, fromISO(start)));
}

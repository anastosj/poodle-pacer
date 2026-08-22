"use client";

export type Feel = "good" | "medium" | "bad";

export interface RunLog {
  completed: boolean;
  miles?: number;
  minutes?: number;
  note?: string;
  feel?: Feel;
  stravaActivityId?: number;
  stravaName?: string;
}

export interface Plan {
  id: string;
  name: string;
  programId: string;
  startDate?: string; // ISO date of week 1 Monday
  logs: Record<string, RunLog>; // key: `${week}-${dayIndex}`
}

export interface AlertSettings {
  phone: string;
  time: string; // HH:MM
  enabled: boolean;
}

export interface RunnerState {
  plans: Plan[];
  activePlanId: string;
  alerts: AlertSettings;
  onboarded?: boolean;
}

export type RunnerId = "jonathan" | "sam";

export const RUNNERS: { id: RunnerId; name: string; emoji: string }[] = [
  { id: "jonathan", name: "Jonathan", emoji: "🏃" },
  { id: "sam", name: "Sam", emoji: "🏃‍♀️" },
];

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

function defaultState(): RunnerState {
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

function storageKey(runner: RunnerId) {
  return `hm-trainer:${runner}`;
}

export function loadState(runner: RunnerId): RunnerState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(storageKey(runner));
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function saveState(runner: RunnerId, state: RunnerState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(runner), JSON.stringify(state));
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

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
}

/** Race day is the last day (Sunday) of the final week. */
export function raceDateFromStart(startDate: string, weeks: number): string {
  return addDays(startDate, weeks * 7 - 1);
}

export function startDateFromRace(raceDate: string, weeks: number): string {
  return addDays(raceDate, -(weeks * 7 - 1));
}

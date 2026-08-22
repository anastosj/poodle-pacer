"use client";

export interface RunLog {
  completed: boolean;
  miles?: number;
  minutes?: number;
  note?: string;
  stravaActivityId?: number;
  stravaName?: string;
}

export interface RunnerState {
  programId: string;
  startDate?: string; // ISO date of week 1 Monday
  logs: Record<string, RunLog>; // key: `${week}-${dayIndex}`
}

export type RunnerId = "jonathan" | "sam";

export const RUNNERS: { id: RunnerId; name: string; emoji: string }[] = [
  { id: "jonathan", name: "Jonathan", emoji: "🏃" },
  { id: "sam", name: "Sam", emoji: "🏃‍♀️" },
];

const defaultState: RunnerState = {
  programId: "hal-higdon-half-novice-1",
  logs: {},
};

function storageKey(runner: RunnerId) {
  return `hm-trainer:${runner}`;
}

export function loadState(runner: RunnerId): RunnerState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = window.localStorage.getItem(storageKey(runner));
    if (!raw) return defaultState;
    return { ...defaultState, ...JSON.parse(raw) };
  } catch {
    return defaultState;
  }
}

export function saveState(runner: RunnerId, state: RunnerState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(runner), JSON.stringify(state));
}

export function logKey(week: number, dayIndex: number) {
  return `${week}-${dayIndex}`;
}

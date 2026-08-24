// Server-side validation for the per-user plan blob. The blob is stored
// verbatim and re-parsed for every runner on each group board render and cron
// alert tick, so an unbounded write by one account is paid for by everybody.
// Writes are therefore capped in bytes and rebuilt field by field: anything
// unrecognized, oversized, or the wrong type is dropped rather than stored.
import { AlertSettings, Plan, RunLog, RunnerState } from "@/lib/store";

/** Largest accepted request body / serialized state, in bytes. */
export const MAX_STATE_BYTES = 256 * 1024;

const MAX_PLANS = 25;
/** A 12 week program has 84 slots; leave room for longer programs and edits. */
const MAX_LOGS_PER_PLAN = 500;
const MAX_SPLITS = 200;
const MAX_ID = 100;
const MAX_NAME = 120;
const MAX_NOTE = 500;
const MAX_POLYLINE = 20_000;
const MAX_LOG_KEY = 20;

function str(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.slice(0, max);
  return trimmed.length > 0 ? trimmed : undefined;
}

function num(
  value: unknown,
  min: number,
  max: number
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value < min || value > max) return undefined;
  return value;
}

function isoDate(value: unknown): string | undefined {
  const s = str(value, 10);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  return Number.isNaN(Date.parse(s)) ? undefined : s;
}

function record(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function sanitizeSplit(raw: unknown) {
  const obj = record(raw);
  if (!obj) return undefined;
  const mile = num(obj.mile, 0, 1000);
  const miles = num(obj.miles, 0, 1000);
  const seconds = num(obj.seconds, 0, 86_400);
  const pace = num(obj.pace, 0, 86_400);
  const elevationChange = num(obj.elevationChange, -100_000, 100_000);
  const heartRate = num(obj.heartRate, 0, 400);
  if (
    mile === undefined ||
    miles === undefined ||
    seconds === undefined ||
    pace === undefined ||
    elevationChange === undefined
  ) {
    return undefined;
  }
  return { mile, miles, seconds, pace, elevationChange, heartRate };
}

function sanitizeSampleDetail(raw: unknown): RunLog["sampleDetail"] {
  const obj = record(raw);
  if (!obj) return undefined;
  const polyline = str(obj.polyline, MAX_POLYLINE);
  if (!polyline || !Array.isArray(obj.splits)) return undefined;
  const splits = obj.splits
    .slice(0, MAX_SPLITS)
    .map(sanitizeSplit)
    .filter((s): s is NonNullable<ReturnType<typeof sanitizeSplit>> => !!s);
  return { splits, polyline };
}

function sanitizeLog(raw: unknown): RunLog | undefined {
  const obj = record(raw);
  if (!obj) return undefined;
  const feel = obj.feel;
  const detail = sanitizeSampleDetail(obj.sampleDetail);
  return {
    completed: obj.completed === true,
    miles: num(obj.miles, 0, 1000),
    minutes: num(obj.minutes, 0, 10_000),
    seconds: num(obj.seconds, 0, 604_800),
    note: str(obj.note, MAX_NOTE),
    feel:
      feel === "good" || feel === "medium" || feel === "bad" ? feel : undefined,
    stravaActivityId: num(obj.stravaActivityId, 0, Number.MAX_SAFE_INTEGER),
    stravaName: str(obj.stravaName, MAX_NAME),
    avgHeartRate: num(obj.avgHeartRate, 0, 400),
    maxHeartRate: num(obj.maxHeartRate, 0, 400),
    elevationGain: num(obj.elevationGain, -100_000, 100_000),
    cadence: num(obj.cadence, 0, 500),
    sampleDetail: detail,
  };
}

function sanitizeLogs(raw: unknown): Record<string, RunLog> {
  const obj = record(raw);
  if (!obj) return {};
  const logs: Record<string, RunLog> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Object.keys(logs).length >= MAX_LOGS_PER_PLAN) break;
    // Keys are `${week}-${dayIndex}`, nothing else is addressable by the UI.
    if (key.length > MAX_LOG_KEY || !/^\d+-\d+$/.test(key)) continue;
    const log = sanitizeLog(value);
    if (log) logs[key] = log;
  }
  return logs;
}

function sanitizePlan(raw: unknown): Plan | undefined {
  const obj = record(raw);
  if (!obj) return undefined;
  const id = str(obj.id, MAX_ID);
  if (!id) return undefined;
  return {
    id,
    name: str(obj.name, MAX_NAME) ?? "My Half Marathon",
    programId: str(obj.programId, MAX_ID) ?? "hal-higdon-half-novice-1",
    startDate: isoDate(obj.startDate),
    beginWeek: num(obj.beginWeek, 1, 100),
    logs: sanitizeLogs(obj.logs),
  };
}

function sanitizeAlerts(raw: unknown): AlertSettings {
  const obj = record(raw) ?? {};
  const time = str(obj.time, 5);
  return {
    phone: str(obj.phone, 20) ?? "",
    time: time && /^\d{2}:\d{2}$/.test(time) ? time : "07:00",
    enabled: obj.enabled === true,
    timezone: str(obj.timezone, 64),
    confirmedPhone: str(obj.confirmedPhone, 20),
  };
}

interface LegacyState {
  programId?: unknown;
  startDate?: unknown;
  logs?: unknown;
}

/**
 * Rebuild a trusted `RunnerState` from an untrusted blob, or return null when
 * it is not usable at all. The result is bounded in size by construction.
 */
export function sanitizeRunnerState(raw: unknown): RunnerState | null {
  const obj = record(raw);
  if (!obj) return null;

  let plans: Plan[];
  if (Array.isArray(obj.plans)) {
    plans = obj.plans
      .slice(0, MAX_PLANS)
      .map(sanitizePlan)
      .filter((p): p is Plan => !!p);
  } else {
    // Pre-multi-plan clients still send a single plan at the top level.
    const legacy = obj as LegacyState;
    const plan = sanitizePlan({
      id: `plan-legacy`,
      name: "My Half Marathon",
      programId: legacy.programId,
      startDate: legacy.startDate,
      logs: legacy.logs,
    });
    plans = plan ? [plan] : [];
  }
  if (plans.length === 0) return null;

  const activePlanId = str(obj.activePlanId, MAX_ID);
  return {
    plans,
    activePlanId:
      activePlanId && plans.some((p) => p.id === activePlanId)
        ? activePlanId
        : plans[0].id,
    alerts: sanitizeAlerts(obj.alerts),
    onboarded: obj.onboarded === true,
  };
}

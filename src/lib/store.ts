// Plain types and pure helpers, shared by client components and server code
// (the group view summarizes every runner's plan on the server). The
// localStorage helpers below guard on `typeof window`, so this is import-safe
// from either side.
import {
  addDaysISO,
  daysBetween,
  fromISO,
  isISODate,
  startOfToday,
  weekdayIndex,
} from "@/lib/dates";
import {
  Program,
  SUNDAY_INDEX,
  getProgram,
  withRaceDayIndex,
} from "@/lib/programs";

export type Feel = "good" | "medium" | "bad";

/** One wording, used by the picker and the workout detail alike. */
export const FEEL_LABEL: Record<Feel, string> = {
  good: "Felt good!",
  medium: "Felt okay",
  bad: "Felt ruff",
};

export interface RunLog {
  completed: boolean;
  /**
   * Distance in miles, whatever the sport. Swims are stored in miles too and
   * shown in yards, so there is one distance field to reason about.
   */
  miles?: number;
  /**
   * Which sport actually filled this slot, when it is known. Absent on logs
   * written before sports were tracked, which were all running.
   */
  sportType?: string;
  /** Legacy whole-minute duration. Superseded by `seconds`, read via `logSeconds`. */
  minutes?: number;
  /** Precise duration in seconds, so pace is accurate. */
  seconds?: number;
  note?: string;
  feel?: Feel;
  /**
   * The date the activity actually happened, when that is not the day the
   * workout is scheduled on — a Tuesday tempo run finally done on Wednesday
   * and matched back to its slot. Absent whenever the two agree.
   */
  loggedDate?: string;
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

/** Why a stretch of the plan was stood down. Shapes the wording, nothing else. */
export type PauseReason = "injury" | "illness" | "travel" | "life";

export const PAUSE_REASON_LABEL: Record<PauseReason, string> = {
  injury: "Injured",
  illness: "Unwell",
  travel: "Travelling",
  life: "Life happened",
};

export const PAUSE_REASONS = Object.keys(PAUSE_REASON_LABEL) as PauseReason[];

/**
 * A stretch the runner stood down from, inclusive of both ends.
 *
 * Days inside one are not failures: they keep their workout, but they are left
 * out of consistency, they cannot break a streak, and they read as paused
 * rather than missed. Nothing about the schedule moves — the plan stays
 * anchored to race day, which is the whole point of pausing rather than
 * shifting.
 */
export interface PlanPause {
  /** Local ISO date, inclusive. */
  fromIso: string;
  /** Local ISO date, inclusive. */
  toIso: string;
  reason?: PauseReason;
}

export interface Plan {
  id: string;
  name: string;
  programId: string;
  /** ISO date of program week 1, day 0 (Monday). May sit in the past. */
  startDate?: string;
  /**
   * Which day of the final program week the race falls on, Monday = 0. Absent
   * means Sunday, which is how the programs are published.
   */
  raceDayIndex?: number;
  /**
   * First program week the runner actually trains. Greater than 1 when the
   * race is closer than the full program length, so they join partway in and
   * work backwards from race day rather than starting with weeks of misses.
   */
  beginWeek?: number;
  logs: Record<string, RunLog>; // key: `${week}-${dayIndex}`
  /**
   * Days the runner has shuffled within a program week, keyed by week number.
   * Each value is a permutation of 0-6 read as position → program day index:
   * `dayOrder["3"][2]` is the workout that now falls on the third day of
   * program week 3. Weeks left alone are simply absent.
   *
   * Storing a permutation rather than rewriting the schedule keeps the log
   * keys — which are program slots — valid, so a workout carries whatever was
   * logged against it to its new day, and the week's total load is unchanged.
   */
  dayOrder?: Record<string, number[]>;
  /** Stretches the runner stood down from, ascending, never overlapping. */
  pauses?: PlanPause[];
  raceResult?: { miles?: number; seconds?: number; note?: string };
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

/**
 * A run pulled from Strava, stored by date rather than by plan slot, so the
 * calendar keeps a log even with no plan or a plan that hasn't started.
 */
export interface SyncedRun {
  stravaActivityId: number;
  /** ISO local date the run started. */
  date: string;
  name?: string;
  /**
   * Strava's sport type, e.g. "Run", "Ride", "Swim". Absent on records synced
   * before other sports were supported, which were all runs.
   */
  sportType?: string;
  miles: number;
  seconds: number;
  /** How it felt. Set here so off-plan activities can be rated too. */
  feel?: Feel;
  avgHeartRate?: number;
  maxHeartRate?: number;
  /** Elevation gain in feet. */
  elevationGain?: number;
  /** Steps per minute. */
  cadence?: number;
}

export interface RunnerState {
  plans: Plan[];
  activePlanId: string;
  alerts: AlertSettings;
  onboarded?: boolean;
  /** Every synced Strava run, sorted by date ascending. */
  runs?: SyncedRun[];
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

const DEFAULT_PROGRAM_ID = "hal-higdon-half-novice-1";
const MAX_PLANS = 25;
const MAX_LOGS = 2000;
const MAX_RUNS = 1000;
const MAX_SPLITS = 200;
const MAX_ID_LENGTH = 200;
const MAX_NAME_LENGTH = 200;
const MAX_NOTE_LENGTH = 2000;
const MAX_POLYLINE_LENGTH = 10000;
const MAX_PAUSES = 100;
const MAX_PROGRAM_WEEKS = 100;

/** Days in a whole program week, Monday through Sunday. */
export const DAYS_PER_WEEK = 7;
const MAX_PHONE_LENGTH = 50;
const MAX_TIMEZONE_LENGTH = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  return typeof value === "string" ? value.slice(0, maxLength) : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function sanitizeSampleDetail(value: unknown): RunLog["sampleDetail"] {
  if (!isRecord(value) || typeof value.polyline !== "string") return undefined;
  if (!Array.isArray(value.splits) || value.splits.length > MAX_SPLITS) {
    return undefined;
  }

  const splits = [];
  for (const split of value.splits) {
    if (!isRecord(split)) return undefined;
    const mile = finiteNumber(split.mile);
    const miles = finiteNumber(split.miles);
    const seconds = finiteNumber(split.seconds);
    const pace = finiteNumber(split.pace);
    const elevationChange = finiteNumber(split.elevationChange);
    if (
      mile === undefined ||
      miles === undefined ||
      seconds === undefined ||
      pace === undefined ||
      elevationChange === undefined
    ) {
      return undefined;
    }
    const heartRate = finiteNumber(split.heartRate);
    splits.push({
      mile,
      miles,
      seconds,
      pace,
      elevationChange,
      ...(heartRate === undefined ? {} : { heartRate }),
    });
  }

  return {
    splits,
    polyline: value.polyline.slice(0, MAX_POLYLINE_LENGTH),
  };
}

function sanitizeLog(value: unknown): RunLog | undefined {
  if (!isRecord(value)) return undefined;

  const log: RunLog = {
    completed: typeof value.completed === "boolean" ? value.completed : false,
  };
  const numberFields = [
    "miles",
    "minutes",
    "seconds",
    "avgHeartRate",
    "maxHeartRate",
    "elevationGain",
    "cadence",
    "stravaActivityId",
  ] as const;
  for (const field of numberFields) {
    const number = finiteNumber(value[field]);
    if (number !== undefined) log[field] = number;
  }

  const note = boundedString(value.note, MAX_NOTE_LENGTH);
  if (note !== undefined) log.note = note;
  if (isISODate(value.loggedDate)) log.loggedDate = value.loggedDate;
  const stravaName = boundedString(value.stravaName, MAX_NAME_LENGTH);
  if (stravaName !== undefined) log.stravaName = stravaName;
  if (value.feel === "good" || value.feel === "medium" || value.feel === "bad") {
    log.feel = value.feel;
  }
  const sportType = boundedString(value.sportType, MAX_NAME_LENGTH);
  if (sportType !== undefined) log.sportType = sportType;
  const sampleDetail = sanitizeSampleDetail(value.sampleDetail);
  if (sampleDetail) log.sampleDetail = sampleDetail;
  return log;
}

function sanitizeLogs(value: unknown): Record<string, RunLog> {
  if (!isRecord(value)) return {};

  const logs: Record<string, RunLog> = {};
  for (const [key, rawLog] of Object.entries(value)) {
    if (
      key === "__proto__" ||
      key === "constructor" ||
      key === "prototype" ||
      key.length > MAX_ID_LENGTH
    ) {
      continue;
    }
    const log = sanitizeLog(rawLog);
    if (log) logs[key] = log;
    if (Object.keys(logs).length >= MAX_LOGS) break;
  }
  return logs;
}

/**
 * Pauses, in ascending order with overlaps and touching ranges folded together.
 * Reversed ranges are righted rather than dropped, so a picker that hands back
 * its ends the other way round still means what the runner intended.
 */
function sanitizePauses(value: unknown): PlanPause[] {
  if (!Array.isArray(value)) return [];
  const ranges: PlanPause[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    if (!isISODate(raw.fromIso) || !isISODate(raw.toIso)) continue;
    const [fromIso, toIso] =
      raw.fromIso <= raw.toIso
        ? [raw.fromIso, raw.toIso]
        : [raw.toIso, raw.fromIso];
    const reason =
      typeof raw.reason === "string" &&
      (PAUSE_REASONS as string[]).includes(raw.reason)
        ? (raw.reason as PauseReason)
        : undefined;
    ranges.push({ fromIso, toIso, ...(reason ? { reason } : {}) });
    if (ranges.length >= MAX_PAUSES) break;
  }
  return mergePauses(ranges);
}

/**
 * Fold a set of ranges into a disjoint ascending list. Ranges that touch end
 * to end become one: a runner who marks two back-to-back weeks away was away
 * once, and two adjacent chips would only invite deleting half a gap.
 */
export function mergePauses(ranges: PlanPause[]): PlanPause[] {
  const sorted = [...ranges].sort((a, b) => a.fromIso.localeCompare(b.fromIso));
  const merged: PlanPause[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.fromIso <= addDaysISO(last.toIso, 1)) {
      if (range.toIso > last.toIso) last.toIso = range.toIso;
      last.reason = last.reason ?? range.reason;
      continue;
    }
    merged.push({ ...range });
  }
  return merged.slice(0, MAX_PAUSES);
}

/**
 * Per-week day orders, keeping only real permutations of 0-6. Anything else —
 * a short list, a repeated index, a week number out of range — is a schedule
 * that could hide or duplicate a workout, so it is dropped rather than
 * repaired: the untouched program week is always a safe answer.
 */
function sanitizeDayOrder(value: unknown): Record<string, number[]> {
  if (!isRecord(value)) return {};
  const orders: Record<string, number[]> = {};
  for (const [key, raw] of Object.entries(value)) {
    const week = Number(key);
    if (!Number.isInteger(week) || week < 1 || week > MAX_PROGRAM_WEEKS) {
      continue;
    }
    if (!Array.isArray(raw) || raw.length !== DAYS_PER_WEEK) continue;
    const seen = new Set<number>();
    let valid = true;
    for (const index of raw) {
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= DAYS_PER_WEEK ||
        seen.has(index)
      ) {
        valid = false;
        break;
      }
      seen.add(index);
    }
    if (!valid) continue;
    // A week back in its program order is the default, so storing it would
    // only grow the document every time a move was undone.
    if (isIdentityOrder(raw)) continue;
    orders[String(week)] = [...(raw as number[])];
    if (Object.keys(orders).length >= MAX_PROGRAM_WEEKS) break;
  }
  return orders;
}

/**
 * Plans saved before race day could be any weekday were anchored at
 * `race - (weeks * 7 - 1)`, which lands mid-week whenever the race is not a
 * Sunday. Re-anchor those to the Monday of that week and record the weekday the
 * race is actually on, keeping race day exactly where the runner put it, so
 * program weeks line up with calendar weeks and the taper finishes on the race.
 */
function realignLegacyStart(plan: Plan): void {
  if (!plan.startDate || plan.raceDayIndex !== undefined) return;
  if (weekdayIndex(fromISO(plan.startDate)) === 0) return;

  const { weeks } = getProgram(plan.programId);
  const raceDate = addDaysISO(plan.startDate, weeks * 7 - 1);
  const raceDayIndex = weekdayIndex(fromISO(raceDate));
  plan.raceDayIndex = raceDayIndex;
  plan.startDate = startDateFromRace(raceDate, weeks, raceDayIndex);
}

function sanitizePlan(value: unknown): Plan | undefined {
  if (!isRecord(value)) return undefined;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (!id) return undefined;

  const plan: Plan = {
    id: id.slice(0, MAX_ID_LENGTH),
    name: boundedString(value.name, MAX_NAME_LENGTH) ?? "",
    programId:
      typeof value.programId === "string" && value.programId.trim()
        ? value.programId.slice(0, MAX_ID_LENGTH)
        : DEFAULT_PROGRAM_ID,
    logs: sanitizeLogs(value.logs),
  };
  const beginWeek = finiteNumber(value.beginWeek);
  if (
    beginWeek !== undefined &&
    Number.isInteger(beginWeek) &&
    beginWeek >= 1 &&
    beginWeek <= 100
  ) {
    plan.beginWeek = beginWeek;
  }

  const dayOrder = sanitizeDayOrder(value.dayOrder);
  if (Object.keys(dayOrder).length > 0) plan.dayOrder = dayOrder;

  const pauses = sanitizePauses(value.pauses);
  if (pauses.length > 0) plan.pauses = pauses;

  if (isISODate(value.startDate)) plan.startDate = value.startDate;
  const raceDayIndex = finiteNumber(value.raceDayIndex);
  if (
    raceDayIndex !== undefined &&
    Number.isInteger(raceDayIndex) &&
    raceDayIndex >= 0 &&
    raceDayIndex <= SUNDAY_INDEX
  ) {
    plan.raceDayIndex = raceDayIndex;
  }
  realignLegacyStart(plan);
  if (isRecord(value.raceResult)) {
    const miles = finiteNumber(value.raceResult.miles);
    const seconds = finiteNumber(value.raceResult.seconds);
    const note = boundedString(value.raceResult.note, MAX_NOTE_LENGTH);
    if (miles !== undefined || seconds !== undefined || note !== undefined) {
      plan.raceResult = {
        ...(miles === undefined ? {} : { miles }),
        ...(seconds === undefined ? {} : { seconds }),
        ...(note === undefined ? {} : { note }),
      };
    }
  }
  return plan;
}

function sanitizeRun(value: unknown): SyncedRun | undefined {
  if (!isRecord(value)) return undefined;
  const stravaActivityId = finiteNumber(value.stravaActivityId);
  const miles = finiteNumber(value.miles);
  const seconds = finiteNumber(value.seconds);
  if (
    stravaActivityId === undefined ||
    miles === undefined ||
    seconds === undefined ||
    !isISODate(value.date)
  ) {
    return undefined;
  }
  const run: SyncedRun = { stravaActivityId, date: value.date, miles, seconds };
  const name = boundedString(value.name, MAX_NAME_LENGTH);
  if (name !== undefined) run.name = name;
  const sportType = boundedString(value.sportType, MAX_NAME_LENGTH);
  if (sportType !== undefined) run.sportType = sportType;
  if (value.feel === "good" || value.feel === "medium" || value.feel === "bad") {
    run.feel = value.feel;
  }
  for (const field of [
    "avgHeartRate",
    "maxHeartRate",
    "elevationGain",
    "cadence",
  ] as const) {
    const number = finiteNumber(value[field]);
    if (number !== undefined) run[field] = number;
  }
  return run;
}

function sanitizeRuns(value: unknown): SyncedRun[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const runs: SyncedRun[] = [];
  for (const raw of value) {
    const run = sanitizeRun(raw);
    if (!run || seen.has(run.stravaActivityId)) continue;
    seen.add(run.stravaActivityId);
    runs.push(run);
    if (runs.length >= MAX_RUNS) break;
  }
  return runs.sort((a, b) => a.date.localeCompare(b.date));
}

function sanitizeAlerts(value: unknown): AlertSettings {
  const alerts = isRecord(value) ? value : {};
  const time =
    typeof alerts.time === "string" && /^\d{2}:\d{2}$/.test(alerts.time)
      ? alerts.time
      : "07:00";
  const settings: AlertSettings = {
    phone: boundedString(alerts.phone, MAX_PHONE_LENGTH) ?? "",
    time,
    enabled: typeof alerts.enabled === "boolean" ? alerts.enabled : false,
  };
  const timezone = boundedString(alerts.timezone, MAX_TIMEZONE_LENGTH);
  if (timezone !== undefined) settings.timezone = timezone;
  const confirmedPhone = boundedString(
    alerts.confirmedPhone,
    MAX_PHONE_LENGTH
  );
  if (confirmedPhone !== undefined) settings.confirmedPhone = confirmedPhone;
  return settings;
}

function sanitizeStateInternal(raw: unknown): RunnerState {
  if (!isRecord(raw)) return defaultState();
  const plans = Array.isArray(raw.plans)
    ? raw.plans
        .map(sanitizePlan)
        .filter((plan): plan is Plan => plan !== undefined)
        .slice(0, MAX_PLANS)
    : [];
  if (plans.length === 0) return defaultState();

  const activePlanId =
    typeof raw.activePlanId === "string" &&
    plans.some((plan) => plan.id === raw.activePlanId)
      ? raw.activePlanId
      : plans[0].id;
  const runs = sanitizeRuns(raw.runs);
  return {
    plans,
    activePlanId,
    alerts: sanitizeAlerts(raw.alerts),
    ...(typeof raw.onboarded === "boolean" ? { onboarded: raw.onboarded } : {}),
    ...(runs.length > 0 ? { runs } : {}),
  };
}

export function sanitizeState(raw: unknown): RunnerState {
  try {
    return sanitizeStateInternal(raw);
  } catch {
    return defaultState();
  }
}

function migrate(raw: LegacyState & Partial<RunnerState>): RunnerState {
  if (Array.isArray(raw.plans) && raw.plans.length > 0) {
    const firstPlan = raw.plans.find((plan) => isRecord(plan));
    return {
      plans: raw.plans,
      activePlanId:
        typeof raw.activePlanId === "string" &&
        raw.plans.some((p) => isRecord(p) && p.id === raw.activePlanId)
          ? raw.activePlanId
          : typeof firstPlan?.id === "string"
            ? firstPlan.id
            : "",
      alerts: raw.alerts ?? { phone: "", time: "07:00", enabled: false },
      onboarded: raw.onboarded,
      runs: raw.runs,
    };
  }
  const plan: Plan = {
    ...makePlan("My Half Marathon"),
    programId: raw.programId ?? DEFAULT_PROGRAM_ID,
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
  try {
    return sanitizeState(
      !raw || typeof raw !== "object"
        ? defaultState()
        : migrate(raw as LegacyState & Partial<RunnerState>)
    );
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
    return normalizeState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function saveState(userId: string, state: RunnerState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    storageKey(userId),
    JSON.stringify(normalizeState(state))
  );
}

/** What this device knows about how its cache relates to the server's copy. */
export interface SyncMark {
  /**
   * Server timestamp of the last copy this device successfully exchanged with
   * the server, ISO 8601. Null before the first exchange.
   */
  syncedAt: string | null;
  /**
   * True when a local edit has not yet been acknowledged by the server — the
   * runner logged something on a train, or a save is still in flight.
   */
  pending: boolean;
}

const CLEAN: SyncMark = { syncedAt: null, pending: false };

function syncKey(userId: string) {
  return `poodle-pacer:sync:${userId}`;
}

/**
 * Whether the cache holds work the server has not seen.
 *
 * This is deliberately a flag set by the writer rather than a comparison of
 * two timestamps: the local clock and the server clock are different clocks,
 * and a device a few minutes behind would otherwise conclude its own unsaved
 * runs were the stale copy and discard them.
 */
export function readSyncMark(userId: string): SyncMark {
  if (typeof window === "undefined") return CLEAN;
  try {
    const raw = window.localStorage.getItem(syncKey(userId));
    if (!raw) return CLEAN;
    const parsed = JSON.parse(raw) as Partial<SyncMark>;
    return {
      syncedAt:
        typeof parsed.syncedAt === "string" ? parsed.syncedAt : null,
      pending: parsed.pending === true,
    };
  } catch {
    return CLEAN;
  }
}

export function writeSyncMark(userId: string, mark: SyncMark) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(syncKey(userId), JSON.stringify(mark));
  } catch {
    /* private browsing: the guard just never engages */
  }
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

/** Merge freshly synced runs into the log, deduped by Strava activity id. */
export function mergeRuns(
  existing: SyncedRun[],
  incoming: SyncedRun[]
): { runs: SyncedRun[]; added: number } {
  const byId = new Map(existing.map((r) => [r.stravaActivityId, r]));
  let added = 0;
  for (const run of incoming) {
    const previous = byId.get(run.stravaActivityId);
    if (!previous) added += 1;
    // Strava is the source of truth for the activity itself, but `feel` is the
    // runner's own note and would be wiped by every resync if it were not kept.
    byId.set(run.stravaActivityId, {
      ...run,
      feel: previous?.feel ?? run.feel,
    });
  }
  const runs = Array.from(byId.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_RUNS);
  return { runs, added };
}

/** Activity ids already attached to a slot in this plan. */
export function matchedActivityIds(plan: Plan): Set<number> {
  const ids = new Set<number>();
  for (const log of Object.values(plan.logs)) {
    if (log.stravaActivityId !== undefined) ids.add(log.stravaActivityId);
  }
  return ids;
}

/** Synced runs not matched to any slot of this plan, i.e. the free run log. */
export function unmatchedRuns(state: RunnerState, plan: Plan): SyncedRun[] {
  const runs = state.runs ?? [];
  if (runs.length === 0) return [];
  const matched = matchedActivityIds(plan);
  return runs.filter((run) => !matched.has(run.stravaActivityId));
}

/** View a synced run as a log entry, for the shared detail sheet. */
export function runAsLog(run: SyncedRun): RunLog {
  return {
    completed: true,
    miles: run.miles,
    sportType: run.sportType,
    seconds: run.seconds,
    feel: run.feel,
    stravaActivityId: run.stravaActivityId,
    stravaName: run.name,
    avgHeartRate: run.avgHeartRate,
    maxHeartRate: run.maxHeartRate,
    elevationGain: run.elevationGain,
    cadence: run.cadence,
  };
}

/** Which day of its program week the race sits on, Monday = 0. */
export function raceDayIndexOf(plan: Plan): number {
  const index = plan.raceDayIndex;
  if (index === undefined || !Number.isInteger(index)) return SUNDAY_INDEX;
  return Math.min(Math.max(index, 0), SUNDAY_INDEX);
}

/** Race day: the chosen weekday of the final program week. */
export function raceDateFromStart(
  startDate: string,
  weeks: number,
  raceDayIndex: number = SUNDAY_INDEX
): string {
  return addDaysISO(startDate, (weeks - 1) * 7 + raceDayIndex);
}

export function startDateFromRace(
  raceDate: string,
  weeks: number,
  raceDayIndex: number = SUNDAY_INDEX
): string {
  return addDaysISO(raceDate, -((weeks - 1) * 7 + raceDayIndex));
}

/** The plan's race date, or nothing until it has a start date. */
export function raceDateOf(plan: Plan, weeks: number): string | undefined {
  if (!plan.startDate) return undefined;
  return raceDateFromStart(plan.startDate, weeks, raceDayIndexOf(plan));
}

/**
 * The program as this runner will actually run it: the published schedule with
 * its taper re-anchored to a race that may not be on a Sunday.
 */
export function programForPlan(program: Program, plan: Plan): Program {
  return withRaceDayIndex(program, raceDayIndexOf(plan));
}

/** Whether a date sits inside a stood-down stretch. */
export function pauseCovering(
  plan: Plan,
  iso: string
): PlanPause | undefined {
  return plan.pauses?.find((p) => iso >= p.fromIso && iso <= p.toIso);
}

export function isPausedOn(plan: Plan, iso: string): boolean {
  return pauseCovering(plan, iso) !== undefined;
}

/** Stand down a stretch, folding it into any pause it meets. */
export function addPause(plan: Plan, pause: PlanPause): Plan {
  return { ...plan, pauses: mergePauses([...(plan.pauses ?? []), pause]) };
}

/** Lift the pause covering a date, if there is one. */
export function removePauseOn(plan: Plan, iso: string): Plan {
  const pauses = (plan.pauses ?? []).filter(
    (p) => !(iso >= p.fromIso && iso <= p.toIso)
  );
  if (pauses.length === (plan.pauses?.length ?? 0)) return plan;
  const next = { ...plan };
  if (pauses.length > 0) next.pauses = pauses;
  else delete next.pauses;
  return next;
}

/** Total days stood down, for the recap line. */
export function pausedDayCount(plan: Plan): number {
  return (plan.pauses ?? []).reduce(
    (sum, p) => sum + daysBetween(fromISO(p.fromIso), fromISO(p.toIso)) + 1,
    0
  );
}

/**
 * A program week in its published order: position 0 is Monday's workout, and
 * so on to Sunday. The shared identity used whenever a week has not been
 * shuffled, so it is frozen rather than rebuilt.
 */
const PROGRAM_DAY_ORDER: readonly number[] = Object.freeze([
  0, 1, 2, 3, 4, 5, 6,
]);

function isIdentityOrder(order: readonly unknown[]): boolean {
  return order.every((index, position) => index === position);
}

/**
 * Which program day sits in each position of a week, Monday first. Falls back
 * to the program's own order for any week the runner has not rearranged.
 */
function weekDayOrder(plan: Plan, week: number): readonly number[] {
  const order = plan.dayOrder?.[String(week)];
  return Array.isArray(order) && order.length === DAYS_PER_WEEK
    ? order
    : PROGRAM_DAY_ORDER;
}

/**
 * Which program day sits at a position of a week, Monday first.
 *
 * `weekLength` is how many days the week actually holds. A stored order is a
 * permutation of a whole week, so it can only be applied to one: the final
 * week of a plan whose race is not on a Sunday is short — the taper has been
 * slid earlier to finish on race day — and there the program's own order is
 * the only one that means anything.
 */
export function dayIndexAt(
  plan: Plan,
  week: number,
  position: number,
  weekLength: number = DAYS_PER_WEEK
): number {
  if (weekLength !== DAYS_PER_WEEK) return position;
  return weekDayOrder(plan, week)[position] ?? position;
}

/** Whether a week has been shuffled away from its program order. */
export function isWeekReordered(plan: Plan, week: number): boolean {
  return !isIdentityOrder(weekDayOrder(plan, week));
}

/**
 * Trade the workouts on two days of one program week.
 *
 * A swap rather than an insert, because it is what keeps the promise the
 * feature makes: the week still contains exactly the sessions the program
 * prescribed, in the same quantity, just on different days. Sliding a workout
 * along and pushing the rest down would silently re-space every hard day
 * against every rest day, which is the part of the framework worth keeping.
 */
export function swapWorkoutDays(
  plan: Plan,
  week: number,
  from: number,
  to: number
): Plan {
  if (
    from === to ||
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= DAYS_PER_WEEK ||
    to >= DAYS_PER_WEEK
  ) {
    return plan;
  }
  const order = [...weekDayOrder(plan, week)];
  [order[from], order[to]] = [order[to], order[from]];
  return writeWeekOrder(plan, week, order);
}

/** Put a week back the way the program wrote it. */
export function resetWeekOrder(plan: Plan, week: number): Plan {
  return writeWeekOrder(plan, week, [...PROGRAM_DAY_ORDER]);
}

function writeWeekOrder(plan: Plan, week: number, order: number[]): Plan {
  const dayOrder = { ...(plan.dayOrder ?? {}) };
  if (isIdentityOrder(order)) delete dayOrder[String(week)];
  else dayOrder[String(week)] = order;

  const next = { ...plan };
  if (Object.keys(dayOrder).length > 0) next.dayOrder = dayOrder;
  else delete next.dayOrder;
  return next;
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
 * Anchor a plan to race day. Race day sets the weekday the plan finishes on,
 * and week 1 still opens on the Monday that many weeks earlier, so training
 * always begins at the top of a week however the race falls.
 *
 * If the full program no longer fits before the race, begin at the week that
 * covers today and taper from there. Picking a race four weeks out should
 * start you at week 9 of 12, not bury you under eight weeks of missed
 * workouts.
 */
export function planFromRaceDate(
  raceDate: string,
  weeks: number,
  today: Date = startOfToday()
): { startDate: string; beginWeek: number; raceDayIndex: number } {
  const raceDayIndex = weekdayIndex(fromISO(raceDate));
  const startDate = startDateFromRace(raceDate, weeks, raceDayIndex);
  const elapsed = daysBetween(fromISO(startDate), today);
  const beginWeek =
    elapsed <= 0 ? 1 : Math.min(Math.floor(elapsed / 7) + 1, weeks);
  return { startDate, beginWeek, raceDayIndex };
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

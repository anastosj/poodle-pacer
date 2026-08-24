/**
 * Morning-text scheduling rules. Pure functions so the cron route stays thin:
 * a text goes out at the runner's alert time on days with a planned workout,
 * never on rest days, except the day before the race (a pep talk) and race
 * day itself, which fires at 7:00 local no matter what time alerts are set to.
 */
import { planCells } from "@/lib/calendar";
import { addDaysISO } from "@/lib/dates";
import { Program, Workout } from "@/lib/programs";
import { AlertSettings, Plan } from "@/lib/store";

export const DEFAULT_TIMEZONE = "America/New_York";

const RACE_DAY_MINUTES = 7 * 60; // 7:00am local, always
/**
 * How long past the target time a send is still considered due. The scheduler
 * ticks every ~15 minutes but can drift; the sent-log dedupes, so a generous
 * window only ever recovers late ticks, never doubles.
 */
const FIRE_WINDOW_MINUTES = 90;

export interface LocalNow {
  /** Local calendar date, YYYY-MM-DD. */
  iso: string;
  /** Minutes since local midnight. */
  minutes: number;
}

/** Resolve `now` into a wall-clock date and time in the runner's timezone. */
export function localNow(timezone: string, now: Date = new Date()): LocalNow {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  // en-CA hour can render midnight as "24".
  const hour = Number(get("hour")) % 24;
  return {
    iso: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + Number(get("minute")),
  };
}

function parseHHMM(time: string): number {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 7 * 60;
  return h * 60 + m;
}

const inWindow = (nowMinutes: number, target: number) =>
  nowMinutes >= target && nowMinutes < target + FIRE_WINDOW_MINUTES;

/*
 * Text bodies are the one place the drawn icon set cannot reach, so these keep
 * the poodle and the blue heart. Everything in the interface uses the SVG icons.
 */

export function workoutMessage(workout: Workout): string {
  return `🐩 Morning! Today's plan: ${workout.label}. Headband on, let's go!`;
}

export function preRaceMessage(raceLabel: string): string {
  return (
    `🐩 Tomorrow is your ${raceLabel}! Trust your training. ` +
    "Lay out your gear, eat well, and get some good sleep. See you at the start line!"
  );
}

export function raceDayMessage(raceLabel: string): string {
  return (
    `🐩💙 IT'S ${raceLabel.toUpperCase()} DAY! One blue headband, zero doubts. ` +
    "Good luck out there. You've absolutely got this!"
  );
}

export const PRE_RACE_MESSAGE = preRaceMessage("race");
export const RACE_DAY_MESSAGE = raceDayMessage("race");

/**
 * The opt-in confirmation, sent once when a runner confirms their number.
 *
 * Carriers require an opt-in message to name the programme, state how often it
 * sends, note that carrier rates apply, and give the STOP and HELP keywords.
 * A campaign gets rejected without them, so keep all four if this is reworded.
 * The sample workout line that used to live here moved to the settings screen,
 * which shows a live preview anyway.
 */
export function confirmationMessage(): string {
  return (
    "🐩 Poodle Pacer: you are subscribed to morning workout texts. " +
    "Up to 1 msg/day. Msg & data rates may apply. " +
    "Reply STOP to cancel, HELP for help."
  );
}

/** What a runner would receive today, for the preview in settings. */
export function previewMessage(workout: Workout | null, hasPlan: boolean): string {
  if (workout && workout.type !== "rest") return workoutMessage(workout);
  if (workout) return "🐩 Rest day. No text today, enjoy the lie-in.";
  return hasPlan
    ? "🐩 Morning! Training hasn't started yet. Rest up, big things ahead."
    : "🐩 Morning! Set a race date to get workout texts.";
}

export interface PendingAlert {
  /** Dedupe key, unique per user per send. */
  key: string;
  body: string;
}

/**
 * The text due right now for this plan, if any. The caller dedupes on `key`,
 * so returning the same alert on consecutive ticks within the window is fine.
 */
export function dueAlert(
  plan: Plan,
  program: Program,
  alerts: AlertSettings,
  now: LocalNow
): PendingAlert | null {
  if (!plan.startDate) return null;
  const cells = planCells(program, plan);
  if (cells.length === 0) return null;

  const race = cells.filter((c) => c.workout.type === "race").at(-1);
  const alertMinutes = parseHHMM(alerts.time);

  if (race && race.iso === now.iso) {
    if (!inWindow(now.minutes, RACE_DAY_MINUTES)) return null;
    return {
      key: `race:${race.iso}`,
      body: raceDayMessage(program.raceLabel),
    };
  }

  if (race && addDaysISO(race.iso, -1) === now.iso) {
    if (!inWindow(now.minutes, alertMinutes)) return null;
    return {
      key: `prerace:${now.iso}`,
      body: preRaceMessage(program.raceLabel),
    };
  }

  const cell = cells.find((c) => c.iso === now.iso);
  if (!cell || cell.workout.type === "rest") return null;
  // Already logged it? They beat the alarm; no nagging.
  if (plan.logs[cell.key]?.completed) return null;
  if (!inWindow(now.minutes, alertMinutes)) return null;
  return { key: `workout:${now.iso}`, body: workoutMessage(cell.workout) };
}

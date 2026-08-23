/**
 * Race-time prediction from logged runs using Riegel's formula:
 * t2 = t1 * (d2 / d1) ^ 1.06. Short runs flatter the estimate, so only runs of
 * 3+ miles qualify, and recent runs (last 60 days) are preferred as the best
 * read on current fitness.
 */
import { CalendarCell, planCells } from "@/lib/calendar";
import { daysBetween, fromISO, startOfToday } from "@/lib/dates";
import { Program } from "@/lib/programs";
import { Plan, logSeconds } from "@/lib/store";

export const HALF_MARATHON_MILES = 13.1094;
const RIEGEL_EXPONENT = 1.06;
const MIN_BASIS_MILES = 3;
const RECENT_DAYS = 60;

export interface RacePrediction {
  /** Predicted finish time, seconds. */
  seconds: number;
  /** Predicted race pace, seconds per mile. */
  pace: number;
  /** The run the prediction is based on. */
  basis: { miles: number; seconds: number; iso: string };
  /** How many qualifying runs were considered. */
  sampleCount: number;
  /** Days until race day; undefined when the race date is unknown or past. */
  daysToRace?: number;
}

export function riegelPredict(
  miles: number,
  seconds: number,
  targetMiles: number = HALF_MARATHON_MILES
): number {
  return seconds * Math.pow(targetMiles / miles, RIEGEL_EXPONENT);
}

interface Effort {
  miles: number;
  seconds: number;
  iso: string;
  predicted: number;
}

function effortOf(cell: CalendarCell, plan: Plan): Effort | null {
  const log = plan.logs[cell.key];
  if (!log?.completed || !log.miles || log.miles < MIN_BASIS_MILES) return null;
  const seconds = logSeconds(log);
  if (!seconds) return null;
  return {
    miles: log.miles,
    seconds,
    iso: cell.iso,
    predicted: riegelPredict(log.miles, seconds),
  };
}

/**
 * Predict the half-marathon finish from the fastest qualifying run. Recent
 * runs first, any run as a fallback so early weeks still get an estimate.
 */
export function predictRace(
  plan: Plan,
  program: Program
): RacePrediction | null {
  const cells = planCells(program, plan);
  if (cells.length === 0) return null;

  const today = startOfToday();
  const efforts = cells
    .map((cell) => effortOf(cell, plan))
    .filter((e): e is Effort => e !== null);
  if (efforts.length === 0) return null;

  const recent = efforts.filter(
    (e) => daysBetween(fromISO(e.iso), today) <= RECENT_DAYS
  );
  const pool = recent.length > 0 ? recent : efforts;
  const best = pool.reduce((a, b) => (b.predicted < a.predicted ? b : a));

  const race = cells.find((c) => c.workout.type === "race");
  const daysToRace = race ? daysBetween(today, race.date) : undefined;

  return {
    seconds: Math.round(best.predicted),
    pace: best.predicted / HALF_MARATHON_MILES,
    basis: { miles: best.miles, seconds: best.seconds, iso: best.iso },
    sampleCount: efforts.length,
    daysToRace:
      daysToRace !== undefined && daysToRace >= 0 ? daysToRace : undefined,
  };
}

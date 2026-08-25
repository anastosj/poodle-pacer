/**
 * Strava sends dozens of sport types. We only need to know enough to decide
 * three things: which icon to draw, which training-plan slots an activity can
 * satisfy, and — most importantly — whether it counts as *running* mileage.
 * Cycling and walking distance must never be folded into running stats.
 */
export type ActivityKind = "run" | "ride" | "swim" | "walk" | "other";

/** Sport types Strava reports that we treat as running. */
const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

const RIDE_TYPES = new Set([
  "Ride",
  "GravelRide",
  "MountainBikeRide",
  "EBikeRide",
  "EMountainBikeRide",
  "VirtualRide",
  "Handcycle",
  "Velomobile",
]);

const SWIM_TYPES = new Set(["Swim"]);

/** On foot, but not running: distance here is not running mileage. */
const WALK_TYPES = new Set(["Walk", "Hike", "Snowshoe"]);

/**
 * Classify a Strava sport type. Records synced before we stored the sport
 * predate any non-run activity, so an absent type means "Run".
 */
export function activityKind(sportType: string | undefined): ActivityKind {
  if (sportType === undefined) return "run";
  if (RUN_TYPES.has(sportType)) return "run";
  if (RIDE_TYPES.has(sportType)) return "ride";
  if (SWIM_TYPES.has(sportType)) return "swim";
  if (WALK_TYPES.has(sportType)) return "walk";
  return "other";
}

/** Only running distance belongs in mileage, pace, and speed records. */
export function countsAsRunning(sportType: string | undefined): boolean {
  return activityKind(sportType) === "run";
}

/** Sports measured in distance; the rest are logged as time only. */
export function tracksDistance(kind: ActivityKind): boolean {
  return kind !== "other";
}

/** "Trail Run" from "TrailRun", for activities we have no nicer name for. */
export function activityLabel(sportType: string | undefined): string {
  if (!sportType) return "Run";
  return sportType.replace(/([a-z])([A-Z])/g, "$1 $2");
}

const YARDS_PER_MILE = 1760;

/**
 * How fast, phrased the way each sport actually phrases it. Runners and
 * walkers read minutes per mile, cyclists read miles per hour, and swimmers
 * read time per 100 yards. Sports without a distance get nothing.
 */
export function formatSpeed(
  kind: ActivityKind,
  miles: number | undefined,
  seconds: number | undefined
): string | null {
  if (!miles || !seconds || miles <= 0 || seconds <= 0) return null;

  if (kind === "ride") {
    const mph = miles / (seconds / 3600);
    // One decimal is how bike computers report it.
    return `${mph.toFixed(1)} mph`;
  }

  if (kind === "swim") {
    const secondsPer100 = seconds / ((miles * YARDS_PER_MILE) / 100);
    return `${formatClock(secondsPer100)}/100yd`;
  }

  if (kind === "run" || kind === "walk") {
    return `${formatClock(seconds / miles)}/mi`;
  }

  return null;
}

/** Seconds as "m:ss", the shared shape of pace and per-100 splits. */
function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) return "–";
  const total = Math.round(totalSeconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** What the speed number means, for labelling a stat tile. */
export function speedLabel(kind: ActivityKind): string {
  if (kind === "ride") return "Avg speed";
  if (kind === "swim") return "Pace /100yd";
  return "Avg pace";
}

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

/** Sports the Progress view can break out, in the order they are offered. */
export const TRACKED_KINDS: ActivityKind[] = ["run", "ride", "swim", "walk"];

export const KIND_LABEL: Record<ActivityKind, string> = {
  run: "Running",
  ride: "Cycling",
  swim: "Swimming",
  walk: "Walking",
  other: "Other",
};

/** What a sport's sessions are called, for counts and "longest" labels. */
export const KIND_NOUN: Record<ActivityKind, string> = {
  run: "run",
  ride: "ride",
  swim: "swim",
  walk: "walk",
  other: "session",
};

/**
 * Which sports a runner has actually done, so the Progress view only offers a
 * choice when there is one to make.
 */
export function kindsPresent(
  activities: { sportType?: string; date: string }[]
): ActivityKind[] {
  const seen = new Set(activities.map((a) => activityKind(a.sportType)));
  return TRACKED_KINDS.filter((k) => seen.has(k));
}

/**
 * The sport Progress should open on.
 *
 * A running plan is a commitment to running, so that wins outright. Without
 * one — or on a triathlon plan, where no single sport is the point — go with
 * whatever the runner is actually doing: the sport they have been most
 * consistent at recently, and failing a clear leader, whatever they did last.
 */
export function defaultKind(
  activities: { sportType?: string; date: string }[],
  planIsRunning: boolean
): ActivityKind {
  if (planIsRunning) return "run";
  const available = kindsPresent(activities);
  if (available.length === 0) return "run";
  if (available.length === 1) return available[0];

  // "Recently" is the last 60 days: long enough to see a habit, short enough
  // that a sport given up months ago does not still own the view.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const counts = new Map<ActivityKind, number>();
  for (const a of activities) {
    if (a.date < cutoffIso) continue;
    const k = activityKind(a.sportType);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const ranked = available
    .map((k) => ({ kind: k, count: counts.get(k) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  // Materially more consistent means half again as many sessions as the next
  // sport. Anything closer is a toss-up, and the last thing done is the better
  // guess at what someone opened the page to see.
  if (ranked[0].count >= ranked[1].count * 1.5 && ranked[0].count > 0) {
    return ranked[0].kind;
  }

  const latest = activities.reduce<{ sportType?: string; date: string } | null>(
    (best, a) => (best === null || a.date > best.date ? a : best),
    null
  );
  return latest ? activityKind(latest.sportType) : ranked[0].kind;
}

/**
 * A distance in the unit its sport is spoken in. Everything is stored in miles;
 * swimmers count yards, so a swim is converted back for display.
 */
export function formatDistance(
  kind: ActivityKind,
  miles: number | undefined
): string | null {
  if (miles === undefined || miles <= 0) return null;
  if (kind === "swim") {
    return `${Math.round(miles * 1760).toLocaleString("en-US")} yd`;
  }
  if (!tracksDistance(kind)) return null;
  return `${Math.round(miles * 100) / 100} mi`;
}

/** What the distance number is, for labelling a stat tile. */
export function distanceLabel(kind: ActivityKind): string {
  return kind === "swim" ? "Yards" : "Miles";
}

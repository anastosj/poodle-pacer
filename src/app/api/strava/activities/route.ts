import { NextResponse } from "next/server";
import { countsAsRunning } from "@/lib/activities";
import { currentUserId } from "@/lib/session";
import { getFreshTokens, hasActivityScope } from "@/lib/strava";
import { stravaErrorResponse } from "@/lib/strava-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.280839895;

export interface StravaRun {
  id: number;
  name: string;
  miles: number;
  /** Moving time in seconds, the basis for accurate pace. */
  seconds: number;
  startDate: string; // ISO
  /** Strava's sport type, e.g. "Run", "Ride", "Swim", "WeightTraining". */
  sportType: string;
  avgHeartRate?: number;
  maxHeartRate?: number;
  /** Elevation gain in feet. */
  elevationGain?: number;
  /** Steps per minute. */
  cadence?: number;
}

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  /** Newer, more granular than `type`; absent on older activities. */
  sport_type?: string;
  distance: number;
  moving_time: number;
  start_date_local: string;
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain?: number;
  average_cadence?: number;
}

const round = (n: number, places = 0) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

export async function GET() {
  const userId = currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tokens = await getFreshTokens(userId);
  if (!tokens) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }
  if (!hasActivityScope(tokens.scope)) {
    return NextResponse.json({ error: "missing_scope" }, { status: 403 });
  }
  const res = await fetch(
    "https://www.strava.com/api/v3/athlete/activities?per_page=100",
    {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    return stravaErrorResponse(res);
  }
  const activities: StravaActivity[] = await res.json();

  // Every sport is kept: the calendar shows them all, and only running ones
  // are counted as running mileage downstream.
  const runs: StravaRun[] = activities.map((a) => {
    const sportType = a.sport_type ?? a.type;
    const isRun = countsAsRunning(sportType);
    return {
      id: a.id,
      name: a.name,
      miles: round(a.distance / METERS_PER_MILE, 2),
      seconds: a.moving_time,
      startDate: a.start_date_local,
      sportType,
      avgHeartRate: a.average_heartrate ? round(a.average_heartrate) : undefined,
      maxHeartRate: a.max_heartrate ? round(a.max_heartrate) : undefined,
      elevationGain: a.total_elevation_gain
        ? round(a.total_elevation_gain * FEET_PER_METER)
        : undefined,
      // Strava reports run cadence per leg; double it for steps per minute.
      // Other sports report cadence in their own units, so leave those alone.
      cadence: a.average_cadence
        ? round(a.average_cadence * (isRun ? 2 : 1))
        : undefined,
    };
  });

  return NextResponse.json({ runs });
}

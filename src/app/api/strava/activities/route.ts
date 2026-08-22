import { NextRequest, NextResponse } from "next/server";
import { getFreshTokens, isRunnerId } from "@/lib/strava";

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.280839895;

export interface StravaRun {
  id: number;
  name: string;
  miles: number;
  /** Moving time in seconds — the basis for accurate pace. */
  seconds: number;
  startDate: string; // ISO
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

export async function GET(request: NextRequest) {
  const runner = request.nextUrl.searchParams.get("runner");
  if (!isRunnerId(runner)) {
    return NextResponse.json({ error: "Unknown runner" }, { status: 400 });
  }
  const tokens = await getFreshTokens(runner);
  if (!tokens) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }
  const res = await fetch(
    "https://www.strava.com/api/v3/athlete/activities?per_page=100",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    return NextResponse.json({ error: "Strava API error" }, { status: 502 });
  }
  const activities: StravaActivity[] = await res.json();

  const runs: StravaRun[] = activities
    .filter((a) => a.type === "Run")
    .map((a) => ({
      id: a.id,
      name: a.name,
      miles: round(a.distance / METERS_PER_MILE, 2),
      seconds: a.moving_time,
      startDate: a.start_date_local,
      avgHeartRate: a.average_heartrate ? round(a.average_heartrate) : undefined,
      maxHeartRate: a.max_heartrate ? round(a.max_heartrate) : undefined,
      elevationGain: a.total_elevation_gain
        ? round(a.total_elevation_gain * FEET_PER_METER)
        : undefined,
      // Strava reports run cadence per leg; double it for steps per minute.
      cadence: a.average_cadence ? round(a.average_cadence * 2) : undefined,
    }));

  return NextResponse.json({ runs });
}

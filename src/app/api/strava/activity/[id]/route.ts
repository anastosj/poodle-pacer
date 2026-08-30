import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { getFreshTokens, hasActivityScope } from "@/lib/strava";
import { stravaErrorResponse } from "@/lib/strava-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.280839895;

export interface Split {
  /** 1-based mile number. */
  mile: number;
  /** Miles covered in this split; the last one is usually partial. */
  miles: number;
  seconds: number;
  /** Seconds per mile for this split. */
  pace: number;
  elevationChange: number;
  heartRate?: number;
}

export interface ActivityDetail {
  id: number;
  name: string;
  startDate: string;
  miles: number;
  seconds: number;
  elapsedSeconds: number;
  elevationGain: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  cadence?: number;
  calories?: number;
  splits: Split[];
  /** Encoded polyline of the route, or null for a treadmill run. */
  polyline: string | null;
}

interface StravaSplit {
  distance: number;
  moving_time: number;
  elapsed_time: number;
  elevation_difference: number | null;
  average_heartrate?: number;
}

interface StravaActivityDetail {
  id: number;
  name: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  calories?: number;
  splits_standard?: StravaSplit[];
  map?: { polyline?: string; summary_polyline?: string };
}

const round = (n: number, places = 0) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!/^\d+$/.test(params.id)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  const tokens = await getFreshTokens(userId);
  if (!tokens) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }
  if (!hasActivityScope(tokens.scope)) {
    return NextResponse.json({ error: "missing_scope" }, { status: 403 });
  }

  // Strava only returns activities this token can read, so a runner cannot
  // fetch someone else's by guessing an id.
  const res = await fetch(
    `https://www.strava.com/api/v3/activities/${params.id}`,
    {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      cache: "no-store",
    }
  );
  if (res.status === 404) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!res.ok) {
    return stravaErrorResponse(res);
  }

  const a: StravaActivityDetail = await res.json();

  const splits: Split[] = (a.splits_standard ?? []).map((sp, i) => {
    const miles = sp.distance / METERS_PER_MILE;
    const seconds = sp.moving_time;
    return {
      mile: i + 1,
      miles: round(miles, 2),
      seconds,
      // A short final split would otherwise report a wildly fast pace.
      pace: miles > 0 ? round(seconds / miles) : 0,
      elevationChange: round((sp.elevation_difference ?? 0) * FEET_PER_METER),
      heartRate: sp.average_heartrate ? round(sp.average_heartrate) : undefined,
    };
  });

  const detail: ActivityDetail = {
    id: a.id,
    name: a.name,
    startDate: a.start_date_local,
    miles: round(a.distance / METERS_PER_MILE, 2),
    seconds: a.moving_time,
    elapsedSeconds: a.elapsed_time,
    elevationGain: round((a.total_elevation_gain ?? 0) * FEET_PER_METER),
    avgHeartRate: a.average_heartrate ? round(a.average_heartrate) : undefined,
    maxHeartRate: a.max_heartrate ? round(a.max_heartrate) : undefined,
    cadence: a.average_cadence ? round(a.average_cadence * 2) : undefined,
    calories: a.calories ? round(a.calories) : undefined,
    splits,
    polyline: a.map?.polyline ?? a.map?.summary_polyline ?? null,
  };

  return NextResponse.json({ activity: detail });
}

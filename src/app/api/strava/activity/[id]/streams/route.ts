import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { getFreshTokens, hasActivityScope } from "@/lib/strava";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A run's GPS trace with timings, which is what makes a replay match the run.
 *
 * The activity endpoint only carries the route's shape. These streams add when
 * the runner reached each point, so the replay speeds up on the downhill and
 * waits at the lights instead of gliding round at an invented constant pace.
 */

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.280839895;

/** Long runs record a point a second; more than this adds nothing visible. */
const MAX_POINTS = 900;

export interface RoutePoint {
  lat: number;
  lng: number;
  /** Seconds since the run started. */
  t: number;
  /** Miles covered at this point. */
  d: number;
  /** Feet above sea level, when the device recorded altitude. */
  e?: number;
}

export interface RouteStreams {
  points: RoutePoint[];
  /** Elapsed seconds of the final point. */
  totalSeconds: number;
  totalMiles: number;
}

interface StravaStreams {
  latlng?: { data: [number, number][] };
  time?: { data: number[] };
  distance?: { data: number[] };
  altitude?: { data: number[] };
}

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

  // Strava only serves streams for activities this token can read, so an id
  // belonging to someone else comes back as a 404.
  const res = await fetch(
    `https://www.strava.com/api/v3/activities/${params.id}/streams` +
      `?keys=latlng,time,distance,altitude&key_by_type=true`,
    {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      cache: "no-store",
    }
  );
  if (res.status === 404) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: "strava_error" }, { status: 502 });
  }

  const streams: StravaStreams = await res.json();
  const latlng = streams.latlng?.data;
  if (!latlng?.length) {
    // A treadmill run records time but never a position.
    return NextResponse.json({ error: "no_route" }, { status: 404 });
  }

  const time = streams.time?.data ?? [];
  const distance = streams.distance?.data ?? [];
  const altitude = streams.altitude?.data ?? [];
  const step = Math.ceil(latlng.length / MAX_POINTS);

  const points: RoutePoint[] = [];
  const push = (i: number) => {
    const [lat, lng] = latlng[i];
    points.push({
      lat: Number(lat.toFixed(5)),
      lng: Number(lng.toFixed(5)),
      t: time[i] ?? i,
      d: Number(((distance[i] ?? 0) / METERS_PER_MILE).toFixed(3)),
      e:
        altitude[i] === undefined
          ? undefined
          : Number((altitude[i] * FEET_PER_METER).toFixed(1)),
    });
  };
  for (let i = 0; i < latlng.length; i += step) push(i);
  // Thinning by a fixed step usually drops the finish, and a replay that stops
  // short of where the run ended looks broken.
  if ((latlng.length - 1) % step !== 0) push(latlng.length - 1);

  const last = points[points.length - 1];
  const body: RouteStreams = {
    points,
    totalSeconds: last.t,
    totalMiles: last.d,
  };

  return NextResponse.json(body, {
    // A finished run's trace never changes.
    headers: { "Cache-Control": "private, max-age=86400" },
  });
}

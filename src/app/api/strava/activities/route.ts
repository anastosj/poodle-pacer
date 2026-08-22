import { NextRequest, NextResponse } from "next/server";
import { getFreshTokens, isRunnerId } from "@/lib/strava";

const METERS_PER_MILE = 1609.344;

export interface StravaRun {
  id: number;
  name: string;
  miles: number;
  minutes: number;
  startDate: string; // ISO
}

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
    "https://www.strava.com/api/v3/athlete/activities?per_page=60",
    { headers: { Authorization: `Bearer ${tokens.access_token}` }, cache: "no-store" }
  );
  if (!res.ok) {
    return NextResponse.json({ error: "Strava API error" }, { status: 502 });
  }
  const activities: {
    id: number;
    name: string;
    type: string;
    distance: number;
    moving_time: number;
    start_date_local: string;
  }[] = await res.json();

  const runs: StravaRun[] = activities
    .filter((a) => a.type === "Run")
    .map((a) => ({
      id: a.id,
      name: a.name,
      miles: Math.round((a.distance / METERS_PER_MILE) * 100) / 100,
      minutes: Math.round(a.moving_time / 60),
      startDate: a.start_date_local,
    }));

  return NextResponse.json({ runs });
}

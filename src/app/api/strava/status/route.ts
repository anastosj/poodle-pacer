import { NextRequest, NextResponse } from "next/server";
import { isRunnerId, readTokens, stravaConfigured } from "@/lib/strava";

export function GET(request: NextRequest) {
  const runner = request.nextUrl.searchParams.get("runner");
  if (!isRunnerId(runner)) {
    return NextResponse.json({ error: "Unknown runner" }, { status: 400 });
  }
  const tokens = readTokens(runner);
  return NextResponse.json({
    configured: stravaConfigured(),
    connected: Boolean(tokens),
    athleteName: tokens?.athlete_name ?? null,
  });
}

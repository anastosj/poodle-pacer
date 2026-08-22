import { NextRequest, NextResponse } from "next/server";
import { clearTokens, isRunnerId } from "@/lib/strava";

export function POST(request: NextRequest) {
  const runner = request.nextUrl.searchParams.get("runner");
  if (!isRunnerId(runner)) {
    return NextResponse.json({ error: "Unknown runner" }, { status: 400 });
  }
  clearTokens(runner);
  return NextResponse.json({ ok: true });
}

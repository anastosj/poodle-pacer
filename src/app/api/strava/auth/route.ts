import { NextRequest, NextResponse } from "next/server";
import { isRunnerId, stravaConfigured } from "@/lib/strava";

export function GET(request: NextRequest) {
  const runner = request.nextUrl.searchParams.get("runner");
  if (!isRunnerId(runner)) {
    return NextResponse.json({ error: "Unknown runner" }, { status: 400 });
  }
  if (!stravaConfigured()) {
    return NextResponse.redirect(
      new URL("/?strava_error=not_configured", request.url)
    );
  }
  const redirectUri = new URL("/api/strava/callback", request.url).toString();
  const authorizeUrl = new URL("https://www.strava.com/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", process.env.STRAVA_CLIENT_ID!);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("approval_prompt", "auto");
  authorizeUrl.searchParams.set("scope", "read,activity:read_all");
  authorizeUrl.searchParams.set("state", runner);
  return NextResponse.redirect(authorizeUrl);
}

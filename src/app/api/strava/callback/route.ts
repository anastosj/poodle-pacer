import { NextRequest, NextResponse } from "next/server";
import { isRunnerId, writeTokens, StravaTokens } from "@/lib/strava";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const runner = params.get("state");
  const code = params.get("code");
  const error = params.get("error");

  if (!isRunnerId(runner) || error || !code) {
    return NextResponse.redirect(new URL("/?strava_error=denied", request.url));
  }

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!res.ok) {
    return NextResponse.redirect(
      new URL("/?strava_error=token_exchange", request.url)
    );
  }
  const data = await res.json();
  const tokens: StravaTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete_name: [data.athlete?.firstname, data.athlete?.lastname]
      .filter(Boolean)
      .join(" "),
  };
  const response = NextResponse.redirect(
    new URL(`/?strava_connected=${runner}`, request.url)
  );
  writeTokens(runner, tokens);
  return response;
}

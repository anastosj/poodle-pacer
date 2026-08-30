import "server-only";
import { NextResponse } from "next/server";

/**
 * Strava's rate limit is per application, not per athlete: everybody signed in
 * shares one budget, so one keen runner refreshing can stop syncing for the
 * whole pack. That makes a 429 worth telling apart from a real outage — the
 * advice differs ("wait, it resets on its own" rather than "try again"), and
 * blaming Strava for being unreachable when it answered perfectly well is just
 * wrong.
 */

/** How much of the window Strava says is gone, e.g. "142,1201" of "200,2000". */
export interface RateLimitInfo {
  usage?: string;
  limit?: string;
}

export function rateLimitInfo(response: Response): RateLimitInfo {
  return {
    usage: response.headers.get("x-ratelimit-usage") ?? undefined,
    limit: response.headers.get("x-ratelimit-limit") ?? undefined,
  };
}

/**
 * The response for a failed Strava call, passing a 429 through as a 429 so the
 * client can say something true about it. Everything else stays a 502.
 */
export function stravaErrorResponse(response: Response): NextResponse {
  if (response.status === 429) {
    return NextResponse.json(
      { error: "rate_limited", ...rateLimitInfo(response) },
      { status: 429 }
    );
  }
  return NextResponse.json({ error: "strava_error" }, { status: 502 });
}

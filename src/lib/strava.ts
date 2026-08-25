import {
  StoredTokens,
  loadStravaTokens,
  saveStravaTokens,
} from "@/lib/db";

/** Scope needed to read a user's activities; `read` alone only identifies them. */
export const ACTIVITY_SCOPE = "activity:read_all";
export const LOGIN_SCOPE = `read,${ACTIVITY_SCOPE}`;

export function stravaConfigured(): boolean {
  return Boolean(
    process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET
  );
}

export function hasActivityScope(scope: string | null | undefined): boolean {
  // We ask for "read,activity:read_all", but Strava hands the granted scope
  // back space-separated ("activity:read_all read"), so accept either.
  return Boolean(
    scope
      ?.split(/[,\s]+/)
      .filter(Boolean)
      .includes(ACTIVITY_SCOPE)
  );
}

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope?: string;
  athlete?: {
    id: number;
    firstname?: string;
    lastname?: string;
    profile?: string;
  };
}

/** Exchange an authorization code for tokens. Returns null on any failure. */
export async function exchangeCode(
  code: string
): Promise<StravaTokenResponse | null> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as StravaTokenResponse;
}

/**
 * Valid tokens for a user, refreshing and persisting them when they're close to
 * expiring. Returns null if the user never connected or the refresh was rejected.
 */
export async function getFreshTokens(
  userId: string
): Promise<StoredTokens | null> {
  const tokens = await loadStravaTokens(userId);
  if (!tokens) return null;
  if (tokens.expiresAt > Date.now() / 1000 + 60) return tokens;

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as StravaTokenResponse;
  const fresh: StoredTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    // A refresh response omits scope and athlete; keep what we already knew.
    scope: tokens.scope,
    athleteName: tokens.athleteName,
  };
  await saveStravaTokens(userId, fresh);
  return fresh;
}

export function athleteName(athlete: StravaTokenResponse["athlete"]): string {
  return [athlete?.firstname, athlete?.lastname].filter(Boolean).join(" ");
}

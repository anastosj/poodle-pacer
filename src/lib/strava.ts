import { cookies } from "next/headers";

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  athlete_name?: string;
}

const RUNNER_IDS = ["jonathan", "sam"] as const;
export type RunnerId = (typeof RUNNER_IDS)[number];

export function isRunnerId(value: string | null): value is RunnerId {
  return value !== null && (RUNNER_IDS as readonly string[]).includes(value);
}

export function cookieName(runner: RunnerId) {
  return `strava_tokens_${runner}`;
}

export function readTokens(runner: RunnerId): StravaTokens | null {
  const raw = cookies().get(cookieName(runner))?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StravaTokens;
  } catch {
    return null;
  }
}

export function writeTokens(runner: RunnerId, tokens: StravaTokens) {
  cookies().set(cookieName(runner), JSON.stringify(tokens), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export function clearTokens(runner: RunnerId) {
  cookies().delete(cookieName(runner));
}

export async function getFreshTokens(
  runner: RunnerId
): Promise<StravaTokens | null> {
  const tokens = readTokens(runner);
  if (!tokens) return null;
  if (tokens.expires_at > Date.now() / 1000 + 60) return tokens;

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const fresh: StravaTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete_name: tokens.athlete_name,
  };
  writeTokens(runner, fresh);
  return fresh;
}

export function stravaConfigured(): boolean {
  return Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);
}

import { NextRequest, NextResponse } from "next/server";
import { saveStravaTokens, upsertStravaUser } from "@/lib/db";
import { consumeOAuthReturn, consumeOAuthState, setSession } from "@/lib/session";
import { athleteName, exchangeCode } from "@/lib/strava";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (request: NextRequest, reason: string) =>
  NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // Always burn the stored nonce, even on denial, so it can't be replayed.
  const stateOk = consumeOAuthState(params.get("state"));

  if (params.get("error")) return fail(request, "denied");
  if (!stateOk) return fail(request, "bad_state");

  const code = params.get("code");
  if (!code) return fail(request, "no_code");

  const token = await exchangeCode(code);
  if (!token?.athlete?.id) return fail(request, "token_exchange");

  const user = await upsertStravaUser({
    stravaAthleteId: String(token.athlete.id),
    name: athleteName(token.athlete) || null,
    avatarUrl: token.athlete.profile ?? null,
  });

  await saveStravaTokens(user.id, {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: token.expires_at,
    scope: token.scope ?? null,
    athleteName: user.name,
  });

  setSession(user.id);
  return NextResponse.redirect(new URL(consumeOAuthReturn(), request.url));
}

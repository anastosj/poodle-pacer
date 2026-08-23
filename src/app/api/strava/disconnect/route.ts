import { NextResponse } from "next/server";
import { deleteStravaTokens } from "@/lib/db";
import { clearSession, currentUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Strava is how people sign in, so dropping the tokens also ends the session.
 * otherwise you'd be left signed in with no way to sync.
 */
export async function POST() {
  const userId = currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await deleteStravaTokens(userId);
  clearSession();
  return NextResponse.json({ ok: true });
}

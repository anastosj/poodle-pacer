import { NextResponse } from "next/server";
import { findUser, loadStravaTokens } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { smsConfigured } from "@/lib/sms";
import { hasActivityScope, stravaConfigured } from "@/lib/strava";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who am I? Drives the nav avatar and the Strava card. */
export async function GET() {
  const userId = currentUserId();
  if (!userId) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const user = await findUser(userId);
  if (!user) {
    // Session points at a user that no longer exists.
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const tokens = await loadStravaTokens(userId);
  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      stravaAthleteId: user.stravaAthleteId,
    },
    strava: {
      configured: stravaConfigured(),
      connected: Boolean(tokens),
      canSync: hasActivityScope(tokens?.scope),
      athleteName: tokens?.athleteName ?? user.name,
    },
    sms: { configured: smsConfigured() },
  });
}

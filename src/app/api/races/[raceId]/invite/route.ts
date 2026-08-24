import { NextResponse } from "next/server";
import { findRaceById, getRaceMember, rotateRaceInvite } from "@/lib/db";
import { allowRequest } from "@/lib/rate-limit";
import { currentUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { raceId: string } }
) {
  const id = currentUserId();
  if (!id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const race = await findRaceById(params.raceId);
  const member = await getRaceMember(params.raceId, id);
  if (!race || !member || race.ownerUserId !== id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!allowRequest(`race-rotate:${id}`, 10, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  return NextResponse.json({ inviteCode: await rotateRaceInvite(params.raceId) });
}

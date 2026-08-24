import { NextResponse } from "next/server";
import { findRaceById, getRaceMember, removeRaceMember } from "@/lib/db";
import { currentUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { raceId: string; userId: string } }
) {
  const id = currentUserId();
  if (!id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const race = await findRaceById(params.raceId);
  if (!race || race.ownerUserId !== id || params.userId === id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!(await getRaceMember(params.raceId, params.userId))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await removeRaceMember(params.raceId, params.userId);
  return NextResponse.json({ ok: true });
}

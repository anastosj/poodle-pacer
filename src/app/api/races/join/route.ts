import { NextRequest, NextResponse } from "next/server";
import {
  countRaceMembers,
  countUserRaces,
  findRaceByInviteCode,
  getRaceMember,
  joinRace,
  readUserState,
} from "@/lib/db";
import { allowRequest } from "@/lib/rate-limit";
import { currentUserId } from "@/lib/session";
import { readBoundedJson } from "@/lib/request";
import { activePlan, normalizeState } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RACES = 12;
const MAX_MEMBERS = 100;

export async function POST(request: NextRequest) {
  const id = currentUserId();
  if (!id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!allowRequest(`race-join:${id}`, 20, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const body = await readBoundedJson<{ code?: unknown }>(request, 2000);
  if (!body) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  const code = body.code;
  const normalized = typeof code === "string" ? code.trim().slice(0, 30) : "";
  const race = normalized ? await findRaceByInviteCode(normalized) : null;
  if (!race) {
    // Failed guesses consume the same per-user budget as successful joins.
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (await getRaceMember(race.id, id)) {
    return NextResponse.json({ race });
  }
  if (await countUserRaces(id) >= MAX_RACES) {
    return NextResponse.json({ error: "race_limit" }, { status: 409 });
  }
  if (await countRaceMembers(race.id) >= MAX_MEMBERS) {
    return NextResponse.json({ error: "member_limit" }, { status: 409 });
  }
  const state = normalizeState(await readUserState(id));
  await joinRace(race, id, activePlan(state).id);
  return NextResponse.json({ race });
}

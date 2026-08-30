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
import { programs } from "@/lib/programs";
import {
  activePlan,
  normalizeState,
  updateActivePlan,
} from "@/lib/store";
import { writeUserState } from "@/lib/db";

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
  const body = await readBoundedJson<{ code?: unknown; adoptPlan?: unknown }>(
    request,
    2000
  );
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

  /*
   * Adopting the pack's plan is the whole point of a shared invite: one link
   * and everybody is on the same program from the same Monday. Only the
   * program and the dates are taken — the plan keeps its own name, since
   * renaming what somebody already set up would be a surprise, not a feature.
   */
  const adopt =
    body.adoptPlan === true &&
    race.programId !== null &&
    programs.some((p) => p.id === race.programId);

  const next = adopt
    ? updateActivePlan(state, (plan) => ({
        ...plan,
        programId: race.programId as string,
        startDate: race.startDate ?? undefined,
        // The pack's start date is a real start, so everyone runs week 1 of
        // the program from it, including anyone joining a few days late.
        beginWeek: undefined,
      }))
    : state;

  await joinRace(race, id, activePlan(next).id);
  if (adopt) await writeUserState(id, next);
  return NextResponse.json({ race, adopted: adopt });
}

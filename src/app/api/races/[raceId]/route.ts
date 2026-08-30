import { NextRequest, NextResponse } from "next/server";
import {
  findRaceById,
  getRaceMember,
  leaveRace,
  readUserState,
  setRacePlan,
  updateRaceMember,
} from "@/lib/db";
import { raceLeaderboard } from "@/lib/group";
import { allowRequest } from "@/lib/rate-limit";
import { currentUserId } from "@/lib/session";
import { readBoundedJson } from "@/lib/request";
import { activePlan, normalizeState } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });

export async function GET(
  _request: NextRequest,
  { params }: { params: { raceId: string } }
) {
  const id = currentUserId();
  if (!id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const race = await findRaceById(params.raceId);
  const summaries = await raceLeaderboard(params.raceId, id);
  if (!race || !summaries) return notFound();
  return NextResponse.json({
    race: race.ownerUserId === id ? race : { ...race, inviteCode: "" },
    summaries,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { raceId: string } }
) {
  const id = currentUserId();
  if (!id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const member = await getRaceMember(params.raceId, id);
  if (!member) return notFound();
  if (!allowRequest(`race-member:${id}`, 30, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const body = await readBoundedJson<{
    shareStats?: unknown;
    planId?: unknown;
    syncPackPlan?: unknown;
  }>(request, 2000);
  if (!body) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  const shareStats = body.shareStats;
  const planId = body.planId;
  if (shareStats !== undefined && typeof shareStats !== "boolean") {
    return NextResponse.json({ error: "invalid_share_stats" }, { status: 400 });
  }
  if (planId !== undefined && (typeof planId !== "string" || planId.length > 200)) {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }
  if (planId !== undefined) {
    const state = normalizeState(await readUserState(id));
    if (!state.plans.some((plan) => plan.id === planId)) {
      return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
    }
  }
  /*
   * Point the pack at the owner's current plan. Useful when a pack was made
   * before its owner had picked a race date, which is the common order:
   * gather everyone first, sort out the dates after.
   */
  if (body.syncPackPlan === true) {
    const race = await findRaceById(params.raceId);
    if (!race) return notFound();
    if (race.ownerUserId !== id) {
      return NextResponse.json({ error: "not_owner" }, { status: 403 });
    }
    const plan = activePlan(normalizeState(await readUserState(id)));
    await setRacePlan(params.raceId, id, {
      programId: plan.programId ?? null,
      startDate: plan.startDate ?? null,
    });
  }

  if (
    shareStats === undefined &&
    planId === undefined &&
    body.syncPackPlan !== true
  ) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  if (shareStats !== undefined || planId !== undefined) {
    await updateRaceMember(params.raceId, id, {
      ...(shareStats === undefined ? {} : { shareStats }),
      ...(planId === undefined ? {} : { planId }),
    });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { raceId: string } }
) {
  const id = currentUserId();
  if (!id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await getRaceMember(params.raceId, id))) return notFound();
  await leaveRace(params.raceId, id);
  return NextResponse.json({ ok: true });
}

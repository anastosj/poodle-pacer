import { NextRequest, NextResponse } from "next/server";
import {
  countUserRaces,
  createRace,
  listRacesForUser,
  readUserState,
} from "@/lib/db";
import { allowRequest } from "@/lib/rate-limit";
import { currentUserId } from "@/lib/session";
import { readBoundedJson } from "@/lib/request";
import { activePlan, normalizeState } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RACES = 12;
const MAX_NAME = 100;

function userId() {
  return currentUserId();
}

export async function GET() {
  const id = userId();
  if (!id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ races: await listRacesForUser(id) });
}

export async function POST(request: NextRequest) {
  const id = userId();
  if (!id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!allowRequest(`race-create:${id}`, 10, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const body = await readBoundedJson<{ name?: unknown }>(request, 2000);
  if (!body) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME) : "";
  if (!name) return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  if (await countUserRaces(id) >= MAX_RACES) {
    return NextResponse.json({ error: "race_limit" }, { status: 409 });
  }
  const state = normalizeState(await readUserState(id));
  const race = await createRace(id, name, activePlan(state).id);
  return NextResponse.json({ race }, { status: 201 });
}

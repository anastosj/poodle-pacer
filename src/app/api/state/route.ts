import { NextRequest, NextResponse } from "next/server";
import { readUserState, writeUserState } from "@/lib/db";
import { currentUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorized = () =>
  NextResponse.json({ error: "unauthorized" }, { status: 401 });

export async function GET() {
  const userId = currentUserId();
  if (!userId) return unauthorized();
  return NextResponse.json({ state: await readUserState(userId) });
}

export async function PUT(request: NextRequest) {
  const userId = currentUserId();
  if (!userId) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    state?: unknown;
  } | null;
  if (!body || typeof body !== "object" || body.state === undefined) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  await writeUserState(userId, body.state);
  return NextResponse.json({ ok: true });
}

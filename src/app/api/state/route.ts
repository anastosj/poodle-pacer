import { NextRequest, NextResponse } from "next/server";
import { readUserState, writeUserState } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { normalizeState } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorized = () =>
  NextResponse.json({ error: "unauthorized" }, { status: 401 });
const MAX_BODY_BYTES = 512 * 1024;

export async function GET() {
  const userId = currentUserId();
  if (!userId) return unauthorized();
  return NextResponse.json({ state: await readUserState(userId) });
}

export async function PUT(request: NextRequest) {
  const userId = currentUserId();
  if (!userId) return unauthorized();

  const text = await request.text().catch(() => "");
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  let body: {
    state?: unknown;
  } | null = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object" || body.state === undefined) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  await writeUserState(userId, normalizeState(body.state));
  return NextResponse.json({ ok: true });
}

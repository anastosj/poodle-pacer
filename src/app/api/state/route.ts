import { NextRequest, NextResponse } from "next/server";
import { readUserStateRecord, writeUserState } from "@/lib/db";
import { allowRequest } from "@/lib/rate-limit";
import { currentUserId } from "@/lib/session";
import { MAX_STATE_BYTES } from "@/lib/state-limits";
import { normalizeState } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Client debounces saves by 600ms, so this only trips on abuse. */
const WRITES_PER_MINUTE = 30;

const unauthorized = () =>
  NextResponse.json({ error: "unauthorized" }, { status: 401 });

/**
 * Read the body up to `max` bytes, giving up as soon as it is exceeded so an
 * oversized upload is never buffered in full. Returns null when too large.
 */
async function readBoundedText(
  request: NextRequest,
  max: number
): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return null;

  const body = request.body;
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function GET() {
  const userId = currentUserId();
  if (!userId) return unauthorized();
  const { state, updatedAt } = await readUserStateRecord(userId);
  // `updatedAt` lets the client tell a server copy it has already seen from
  // one written by another device since.
  return NextResponse.json({ state, updatedAt });
}

export async function PUT(request: NextRequest) {
  const userId = currentUserId();
  if (!userId) return unauthorized();

  if (!allowRequest(`state:${userId}`, WRITES_PER_MINUTE, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const text = await readBoundedText(request, MAX_STATE_BYTES);
  if (text === null) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: { state?: unknown } | null = null;
  try {
    body = JSON.parse(text) as { state?: unknown };
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object" || body.state === undefined) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  const updatedAt = await writeUserState(userId, normalizeState(body.state));
  // Handing the stored timestamp back means the client records what the server
  // actually wrote, rather than trusting its own clock to agree.
  return NextResponse.json({ ok: true, updatedAt });
}

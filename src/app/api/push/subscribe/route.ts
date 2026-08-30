import { NextRequest, NextResponse } from "next/server";
import { savePushSubscription } from "@/lib/db";
import { pushConfigured } from "@/lib/push";
import { allowRequest } from "@/lib/rate-limit";
import { currentUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Re-subscribing on every app open is normal, so this is generous but capped. */
const SUBSCRIBES_PER_MINUTE = 20;

/** Endpoints are URLs from the browser's push service; keep them sane. */
const MAX_ENDPOINT_LENGTH = 2000;
const MAX_KEY_LENGTH = 500;

export async function POST(request: NextRequest) {
  const userId = currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!pushConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (!allowRequest(`push:${userId}`, SUBSCRIBES_PER_MINUTE, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  const sub = body as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  } | null;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;

  if (
    typeof endpoint !== "string" ||
    !/^https:\/\//.test(endpoint) ||
    endpoint.length > MAX_ENDPOINT_LENGTH ||
    typeof p256dh !== "string" ||
    p256dh.length > MAX_KEY_LENGTH ||
    typeof auth !== "string" ||
    auth.length > MAX_KEY_LENGTH
  ) {
    return NextResponse.json({ error: "bad_subscription" }, { status: 400 });
  }

  await savePushSubscription(userId, { endpoint, p256dh, auth });
  return NextResponse.json({ ok: true });
}

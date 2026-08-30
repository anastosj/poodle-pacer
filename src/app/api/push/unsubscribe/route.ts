import { NextRequest, NextResponse } from "next/server";
import { deletePushSubscription } from "@/lib/db";
import { currentUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const userId = currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  const endpoint = (body as { endpoint?: unknown } | null)?.endpoint;
  if (typeof endpoint !== "string" || !endpoint) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  // Scoped to the caller inside the query, so this can only ever drop one of
  // their own devices even if the endpoint belongs to somebody else.
  await deletePushSubscription(userId, endpoint);
  return NextResponse.json({ ok: true });
}

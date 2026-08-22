import { NextRequest, NextResponse } from "next/server";
import { readRunnerState, writeRunnerState } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RUNNERS = new Set(["jonathan", "sam"]);

export async function GET(request: NextRequest) {
  const runner = request.nextUrl.searchParams.get("runner") ?? "";
  if (!RUNNERS.has(runner)) {
    return NextResponse.json({ error: "bad_runner" }, { status: 400 });
  }
  return NextResponse.json({ state: readRunnerState(runner) });
}

export async function PUT(request: NextRequest) {
  const runner = request.nextUrl.searchParams.get("runner") ?? "";
  if (!RUNNERS.has(runner)) {
    return NextResponse.json({ error: "bad_runner" }, { status: 400 });
  }
  const body = (await request.json().catch(() => null)) as {
    state?: unknown;
  } | null;
  if (!body || typeof body !== "object" || body.state === undefined) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  writeRunnerState(runner, body.state);
  return NextResponse.json({ ok: true });
}

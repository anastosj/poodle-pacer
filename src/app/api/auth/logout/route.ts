import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  clearSession();
  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
}

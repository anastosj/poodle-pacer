import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { sendSms, smsConfigured } from "@/lib/sms";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!currentUserId()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { phone, message } = await request.json();
  if (!phone || !message) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!smsConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const ok = await sendSms(phone, message);
  if (!ok) {
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

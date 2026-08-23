import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { sendSmsDetailed, smsConfigured } from "@/lib/sms";

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
  const result = await sendSmsDetailed(phone, message);
  if (!result.ok) {
    // Pass Twilio's own code and wording through; "send failed" tells nobody
    // whether the number was wrong, unverified, or the account is restricted.
    return NextResponse.json(
      { error: "send_failed", code: result.code, detail: result.message },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}

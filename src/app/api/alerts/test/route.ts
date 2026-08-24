import { NextResponse } from "next/server";
import { confirmationMessage } from "@/lib/alerts";
import { claimSmsSend, readUserState } from "@/lib/db";
import { toE164 } from "@/lib/phone";
import { currentUserId } from "@/lib/session";
import { sendSmsDetailed, smsConfigured } from "@/lib/sms";
import { normalizeState } from "@/lib/store";

export const runtime = "nodejs";

export async function POST() {
  const userId = currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const state = normalizeState(await readUserState(userId));
  const phone = state.alerts.phone.trim();
  if (!phone) {
    return NextResponse.json({ error: "no_phone" }, { status: 400 });
  }
  const recipient = toE164(phone);
  if (!recipient) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }
  if (!smsConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const day = new Date().toISOString().slice(0, 10);
  let claimed = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    if (await claimSmsSend(userId, `test:${day}:${attempt}`)) {
      claimed = true;
      break;
    }
  }
  if (!claimed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const result = await sendSmsDetailed(recipient, confirmationMessage());
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

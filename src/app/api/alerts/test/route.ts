import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { phone, message } = await request.json();
  if (!phone || !message) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, From: from, Body: message }),
    }
  );
  if (!res.ok) {
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_TIMEZONE, dueAlert, localNow } from "@/lib/alerts";
import { verifyGitHubCronToken } from "@/lib/githubOidc";
import { claimSmsSend, listUsersForAlerts } from "@/lib/db";
import { programs } from "@/lib/programs";
import { sendSms, smsConfigured } from "@/lib/sms";
import { activePlan, normalizeState } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function matchesCronSecret(token: string): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Scheduler tick, hit every ~15 minutes. Checks every runner for a text due
 * right now (workout days at their alert time, race-eve pep talk, 7am race-day
 * good luck) and sends it once. The sms_sends table dedupes across ticks.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const authorized =
    token !== null &&
    (matchesCronSecret(token) || (await verifyGitHubCronToken(token)));
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!smsConfigured()) {
    return NextResponse.json({ error: "sms_not_configured" }, { status: 503 });
  }

  const rows = await listUsersForAlerts();
  const sent: { user: string; key: string; ok: boolean }[] = [];

  for (const { user, state: raw } of rows) {
    if (!raw) continue;
    const state = normalizeState(raw);
    const alerts = state.alerts;
    if (!alerts.enabled || !alerts.phone.trim()) continue;

    const plan = activePlan(state);
    const program =
      programs.find((p) => p.id === plan.programId) ?? programs[0];
    const now = localNow(alerts.timezone || DEFAULT_TIMEZONE);

    const pending = dueAlert(plan, program, alerts, now);
    if (!pending) continue;
    // Claim before sending so overlapping ticks can't double-text.
    if (!(await claimSmsSend(user.id, pending.key))) continue;

    const ok = await sendSms(alerts.phone.trim(), pending.body);
    sent.push({ user: user.id, key: pending.key, ok });
  }

  return NextResponse.json({ ok: true, sent });
}

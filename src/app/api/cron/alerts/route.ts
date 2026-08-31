import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_TIMEZONE, dueAlert, localNow } from "@/lib/alerts";
import { verifyGitHubCronToken } from "@/lib/githubOidc";
import { claimSmsSend, listUsersForAlerts } from "@/lib/db";
import { programs } from "@/lib/programs";
import { pushConfigured, sendPushToUser } from "@/lib/push";
import { sendSms, smsConfigured } from "@/lib/sms";
import { activePlan, normalizeState, programForPlan } from "@/lib/store";

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
 * Scheduler tick, hit every ~15 minutes. Checks every runner for an alert due
 * right now (workout days at their alert time, race-eve pep talk, 7am race-day
 * good luck) and sends it once per channel.
 *
 * Push goes to anyone with a registered browser and needs no opt-in beyond
 * granting the permission — it is free and carries no phone number. A text is
 * sent as well, but only to runners who went out of their way to enable one.
 * Each channel claims its own key, so enabling both gets both, and a failure
 * on one never suppresses the other.
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
  const sms = smsConfigured();
  const push = pushConfigured();
  if (!sms && !push) {
    return NextResponse.json(
      { error: "no_channel_configured" },
      { status: 503 }
    );
  }

  const rows = await listUsersForAlerts();
  const sent: {
    user: string;
    key: string;
    channel: "push" | "sms";
    ok: boolean;
  }[] = [];

  for (const { user, state: raw } of rows) {
    if (!raw) continue;
    const state = normalizeState(raw);
    const alerts = state.alerts;

    const wantsSms = sms && alerts.enabled && Boolean(alerts.phone.trim());
    // Push has no per-user setting: registering a browser is the opt-in, and
    // turning it off there removes the row.
    if (!push && !wantsSms) continue;

    const plan = activePlan(state);
    const program = programForPlan(
      programs.find((p) => p.id === plan.programId) ?? programs[0],
      plan
    );
    const now = localNow(alerts.timezone || DEFAULT_TIMEZONE);

    const pending = dueAlert(plan, program, alerts, now);
    if (!pending) continue;

    if (push) {
      // Claim before sending so overlapping ticks can't double-notify. The
      // channel prefix keeps this claim independent of the text's.
      if (await claimSmsSend(user.id, `push:${pending.key}`)) {
        const result = await sendPushToUser(user.id, {
          title: "Poodle Pacer",
          body: pending.body,
          url: "/",
          tag: pending.key,
        });
        if (result.sent > 0 || result.failed > 0) {
          sent.push({
            user: user.id,
            key: pending.key,
            channel: "push",
            ok: result.sent > 0,
          });
        }
      }
    }

    if (wantsSms && (await claimSmsSend(user.id, pending.key))) {
      const ok = await sendSms(alerts.phone.trim(), pending.body);
      sent.push({ user: user.id, key: pending.key, channel: "sms", ok });
    }
  }

  return NextResponse.json({ ok: true, sent });
}

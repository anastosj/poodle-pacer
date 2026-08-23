/**
 * Server-side Twilio SMS.
 *
 * Messages can be sent either from a bare number or through a Messaging
 * Service. US A2P 10DLC registration attaches numbers to a Messaging Service,
 * and sending through its SID is what keeps traffic associated with the
 * registered campaign, so that path wins when both are configured.
 */

function credentials() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  return { sid, token, from, messagingServiceSid };
}

export function smsConfigured(): boolean {
  const { sid, token, from, messagingServiceSid } = credentials();
  return Boolean(sid && token && (messagingServiceSid || from));
}

/** Why a send failed, so callers can surface something better than "failed". */
export interface SmsResult {
  ok: boolean;
  /** Twilio's numeric error code, when it gave one. */
  code?: number;
  message?: string;
}

export async function sendSmsDetailed(
  to: string,
  body: string
): Promise<SmsResult> {
  const { sid, token, from, messagingServiceSid } = credentials();
  if (!sid || !token || (!messagingServiceSid && !from)) {
    return { ok: false, message: "Twilio is not configured." };
  }

  const params = new URLSearchParams({ To: to, Body: body });
  if (messagingServiceSid) {
    params.set("MessagingServiceSid", messagingServiceSid);
  } else if (from) {
    params.set("From", from);
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
      cache: "no-store",
    }
  );

  if (res.ok) return { ok: true };

  // Twilio returns { code, message } on failure; keep it for the caller.
  const detail = (await res.json().catch(() => null)) as {
    code?: number;
    message?: string;
  } | null;
  return {
    ok: false,
    code: detail?.code,
    message: detail?.message ?? `Twilio returned ${res.status}.`,
  };
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  return (await sendSmsDetailed(to, body)).ok;
}

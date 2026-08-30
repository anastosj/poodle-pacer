import "server-only";
import webpush from "web-push";
import {
  PushSubscriptionRecord,
  deletePushEndpoint,
  listPushSubscriptions,
} from "@/lib/db";

/**
 * Web push delivery.
 *
 * The public key is also exposed to the browser as
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY — it is public by design, and the browser needs
 * it to create a subscription this server is allowed to send to. The private
 * key never leaves here.
 *
 * Unlike SMS this costs nothing per message and needs no phone number, which
 * is why it is the default channel and texting is the opt-in.
 */

function keys() {
  return {
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT || "mailto:hello@poodle-pacer.app",
  };
}

export function pushConfigured(): boolean {
  const { publicKey, privateKey } = keys();
  return Boolean(publicKey && privateKey);
}

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const { publicKey, privateKey, subject } = keys();
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Where clicking the notification should land. */
  url?: string;
  /**
   * Collapse key. A second notification with the same tag replaces the first
   * rather than stacking, so a runner who left the app closed for a week comes
   * back to one message and not seven.
   */
  tag?: string;
}

/**
 * Push to every browser this runner has registered.
 *
 * Endpoints the push service reports as gone (404/410) are deleted rather than
 * retried: a browser that cleared its data would otherwise be attempted on
 * every tick forever. Any other failure is left alone — it may be transient.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!ensureConfigured()) return { sent: 0, failed: 0 };
  const subs = await listPushSubscriptions(userId);
  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await sendOne(sub, payload);
        sent += 1;
      } catch (error) {
        failed += 1;
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await deletePushEndpoint(sub.endpoint).catch(() => {});
        }
      }
    })
  );

  return { sent, failed };
}

function sendOne(sub: PushSubscriptionRecord, payload: PushPayload) {
  return webpush.sendNotification(
    {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    },
    JSON.stringify(payload)
  );
}

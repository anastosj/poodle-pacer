"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { BellIcon } from "@/components/Icons";

/**
 * Browser notifications: the default alert channel.
 *
 * Free to send, needs no phone number, and works in the installed app, so this
 * is the one most runners should end up on. Texting stays available for anyone
 * who wants it, but it is no longer the only way to be reminded.
 */

/**
 * The push service wants the VAPID key as raw bytes, not base64url. Returned
 * as the ArrayBuffer itself: `applicationServerKey` takes any BufferSource,
 * and handing back the buffer sidesteps the typed-array generic entirely.
 */
function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

type Status =
  | "loading"
  | "unsupported"
  | "not-configured"
  | "denied"
  | "off"
  | "on";

export default function PushCard() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!publicKey) return setStatus("not-configured");
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      return setStatus("unsupported");
    }
    if (Notification.permission === "denied") return setStatus("denied");

    // Trust the browser's own registration over anything remembered locally:
    // permissions and subscriptions can be revoked from outside the app.
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "on" : "off"))
      .catch(() => setStatus("unsupported"));
  }, [publicKey]);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(publicKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setStatus("on");
      setMessage("Notifications are on for this browser.");
    } catch {
      setMessage("Couldn't turn notifications on. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [publicKey]);

  const disable = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        // Tell the server first: if unsubscribing locally succeeded but the
        // row survived, this browser would keep being sent to forever.
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
      setMessage("Notifications are off for this browser.");
    } catch {
      setMessage("Couldn't turn notifications off. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const body = () => {
    switch (status) {
      case "loading":
        return <p className="mt-2 type-body text-ink-muted">Checking…</p>;
      case "not-configured":
        return (
          <p className="mt-2 type-body text-ink-muted">
            Notifications aren&apos;t set up on this server yet.
          </p>
        );
      case "unsupported":
        return (
          <p className="mt-2 type-body text-ink-muted">
            This browser doesn&apos;t support notifications. On an iPhone, add
            Poodle Pacer to your Home Screen first.
          </p>
        );
      case "denied":
        return (
          <p className="mt-2 type-body text-ink-muted">
            Notifications are blocked for this site. Allow them in your
            browser&apos;s site settings, then come back.
          </p>
        );
      default:
        return (
          <>
            <p className="mt-2 type-body text-ink-muted">
              A nudge each morning there&apos;s a workout, a pep talk the night
              before your race, and a good-luck on race day. Free, and no phone
              number needed.
            </p>
            <div className="mt-4">
              {status === "on" ? (
                <Button variant="ghost" onClick={disable} disabled={busy}>
                  {busy ? "Turning off…" : "Turn off on this browser"}
                </Button>
              ) : (
                <Button onClick={enable} disabled={busy}>
                  {busy ? "Turning on…" : "Turn on notifications"}
                </Button>
              )}
            </div>
          </>
        );
    }
  };

  return (
    <section className="mt-4 rounded-sm border-3 border-outline bg-surface p-5 shadow-card">
      <h2 className="type-overline flex items-center gap-1.5 text-ink-soft">
        <BellIcon size={14} />
        Notifications
        {status === "on" && (
          <span className="ml-1 rounded-full border-2 border-outline bg-ink px-2 py-0.5 text-meta font-bold text-highlight">
            On
          </span>
        )}
      </h2>
      {body()}
      {message && (
        <p className="mt-3 rounded-sm border-2 border-outline bg-lilac px-3 py-2 text-meta font-bold text-ink">
          {message}
        </p>
      )}
    </section>
  );
}

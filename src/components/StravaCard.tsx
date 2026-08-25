"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppContext";

interface StravaStatus {
  configured: boolean;
  connected: boolean;
  canSync: boolean;
  athleteName: string | null;
}

export default function StravaCard() {
  const { syncStrava } = useApp();
  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setStatus(json?.strava ?? null))
      .catch(() => setStatus(null));
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    setSyncMessage(null);
    const result = await syncStrava();
    setSyncing(false);
    if (!result.ok) {
      setSyncMessage(
        result.error === "missing_scope"
          ? "Poodle Pacer needs permission to read your activities. Re-authorize below."
          : "Couldn't reach Strava. Try again in a moment."
      );
      return;
    }
    const parts: string[] = [];
    if (result.added > 0) {
      parts.push(
        `${result.added} new run${result.added === 1 ? "" : "s"} in your log`
      );
    }
    if (result.matched > 0) {
      parts.push(
        `${result.matched} matched to your plan`
      );
    }
    setSyncMessage(
      parts.length > 0
        ? `Synced: ${parts.join(", ")}.`
        : "You're up to date - no new runs on Strava."
    );
  }, [syncStrava]);

  const disconnect = useCallback(async () => {
    if (
      !window.confirm(
        "Disconnecting Strava also signs you out, since Strava is how you log in. Your training plan is kept. Continue?"
      )
    ) {
      return;
    }
    await fetch("/api/strava/disconnect", { method: "POST" });
    window.location.href = "/login";
  }, []);

  return (
    <section className="rounded-sm border-3 border-outline bg-surface p-5 shadow-card">
      <h2 className="type-overline text-ink-soft">
        Strava
      </h2>
      {!status ? (
        <p className="mt-2 type-body text-ink-muted">Checking…</p>
      ) : (
        <div className="mt-2 space-y-3">
          <p className="type-body">
            Connected{status.athleteName ? ` as ${status.athleteName}` : ""}
          </p>

          {status.canSync ? (
            <div className="space-y-2">
              <p className="type-body text-ink-muted">
                Runs sync automatically each time you open the app and land on
                your calendar, whether or not they&apos;re part of a training
                plan.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={sync}
                  disabled={syncing}
                  className="hard-button focus-pouf rounded-sm bg-primary px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-60"
                >
                  {syncing ? "Fetching runs…" : "Sync now"}
                </button>
                <button
                  onClick={disconnect}
                  className="focus-pouf rounded-full border-2 border-outline px-4 py-2 text-sm font-bold text-ink-muted hover:bg-lilac"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="type-body text-ink-muted">
                You signed in, but didn&apos;t grant permission to read your
                activities, so runs can&apos;t be imported yet.
              </p>
              <a
                href="/api/auth/login?force=1"
                className="inline-block rounded-sm border-3 border-outline bg-[#fc4c02] px-4 py-2 text-sm font-bold uppercase text-white transition hover:opacity-90"
              >
                Grant activity access
              </a>
            </div>
          )}
        </div>
      )}
      {syncMessage && (
        <p className="mt-2 text-meta font-bold text-primary-dark">
          {syncMessage}
        </p>
      )}
    </section>
  );
}

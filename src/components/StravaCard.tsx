"use client";

import { useCallback, useEffect, useState } from "react";
import { Program } from "@/lib/programs";
import { Plan, RunnerId, logKey } from "@/lib/store";

interface StravaStatus {
  configured: boolean;
  connected: boolean;
  athleteName: string | null;
}

interface StravaRun {
  id: number;
  name: string;
  miles: number;
  seconds: number;
  startDate: string;
  avgHeartRate?: number;
  maxHeartRate?: number;
  elevationGain?: number;
  cadence?: number;
}

function weekAndDayFor(
  date: Date,
  startDate: string,
  weeks: number
): { week: number; dayIndex: number } | null {
  const start = new Date(startDate + "T00:00:00");
  const diffDays = Math.floor((date.getTime() - start.getTime()) / 86400000);
  if (diffDays < 0 || diffDays >= weeks * 7) return null;
  return { week: Math.floor(diffDays / 7) + 1, dayIndex: diffDays % 7 };
}

export default function StravaCard({
  runner,
  plan,
  updatePlan,
  program,
}: {
  runner: RunnerId;
  plan: Plan;
  updatePlan: (updater: (prev: Plan) => Plan) => void;
  program: Program;
}) {
  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    setStatus(null);
    setSyncMessage(null);
    fetch(`/api/strava/status?runner=${runner}`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [runner]);

  const sync = useCallback(async () => {
    if (!plan.startDate) {
      setSyncMessage("Set a start date first so runs can be matched!");
      return;
    }
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`/api/strava/activities?runner=${runner}`);
      if (!res.ok) throw new Error("fetch failed");
      const { runs }: { runs: StravaRun[] } = await res.json();
      let matched = 0;
      const logs = { ...plan.logs };
      for (const run of runs) {
        const slot = weekAndDayFor(
          new Date(run.startDate),
          plan.startDate,
          program.weeks
        );
        if (!slot) continue;
        const key = logKey(slot.week, slot.dayIndex);
        const existing = logs[key];
        if (existing?.stravaActivityId === run.id) continue;
        logs[key] = {
          ...existing,
          completed: true,
          miles: run.miles,
          seconds: run.seconds,
          minutes: undefined, // superseded by `seconds`
          stravaActivityId: run.id,
          stravaName: run.name,
          avgHeartRate: run.avgHeartRate,
          maxHeartRate: run.maxHeartRate,
          elevationGain: run.elevationGain,
          cadence: run.cadence,
        };
        matched += 1;
      }
      updatePlan((prev) => ({ ...prev, logs }));
      setSyncMessage(
        matched > 0
          ? `Synced ${matched} run${matched === 1 ? "" : "s"} from Strava! 🎉`
          : "No new runs matched your training window."
      );
    } catch {
      setSyncMessage("Couldn't reach Strava — try reconnecting.");
    } finally {
      setSyncing(false);
    }
  }, [runner, plan, program.weeks, updatePlan]);

  const disconnect = useCallback(async () => {
    await fetch(`/api/strava/disconnect?runner=${runner}`, { method: "POST" });
    setStatus((s) => (s ? { ...s, connected: false, athleteName: null } : s));
  }, [runner]);

  return (
    <section className="rounded-pouf bg-poodle-white p-5 ring-1 ring-poodle-fur pouf-shadow">
      <h2 className="text-sm font-bold uppercase tracking-wide text-foreground/60">
        Strava
      </h2>
      {!status ? (
        <p className="mt-2 text-sm text-foreground/60">Checking…</p>
      ) : !status.configured ? (
        <p className="mt-2 text-sm text-foreground/60">
          Strava isn&apos;t configured yet. Add <code>STRAVA_CLIENT_ID</code> and{" "}
          <code>STRAVA_CLIENT_SECRET</code> to enable syncing.
        </p>
      ) : status.connected ? (
        <div className="mt-2 space-y-3">
          <p className="text-sm">
            Connected{status.athleteName ? ` as ${status.athleteName}` : ""} ✅
          </p>
          <div className="flex gap-2">
            <button
              onClick={sync}
              disabled={syncing}
              className="rounded-full bg-headband px-4 py-2 text-sm font-semibold text-white transition hover:bg-headband-dark disabled:opacity-60"
            >
              {syncing ? "Fetching runs…" : "Sync runs"}
            </button>
            <button
              onClick={disconnect}
              className="rounded-full px-4 py-2 text-sm font-medium text-foreground/60 ring-1 ring-poodle-fur hover:bg-poodle-cream"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-foreground/70">
            Connect Strava to auto-log your runs.
          </p>
          <a
            href={`/api/strava/auth?runner=${runner}`}
            className="inline-block rounded-full bg-[#fc4c02] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Connect with Strava
          </a>
        </div>
      )}
      {syncMessage && (
        <p className="mt-2 text-xs font-medium text-headband-dark">
          {syncMessage}
        </p>
      )}
    </section>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Program, workoutTracksRunningMiles } from "@/lib/programs";
import { Plan, logKey } from "@/lib/store";

interface StravaStatus {
  configured: boolean;
  connected: boolean;
  canSync: boolean;
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
  plan,
  updatePlan,
  program,
}: {
  plan: Plan;
  updatePlan: (updater: (prev: Plan) => Plan) => void;
  program: Program;
}) {
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
    if (!plan.startDate) {
      setSyncMessage("Set a race date first so runs can be matched!");
      return;
    }
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/strava/activities");
      if (res.status === 403) {
        setSyncMessage(
          "Poodle Pacer needs permission to read your activities. Re-authorize below."
        );
        return;
      }
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
        const workout = program.schedule.find(
          (programWeek) => programWeek.week === slot.week,
        )?.days[slot.dayIndex];
        if (!workout || !workoutTracksRunningMiles(workout)) continue;
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
          ? `Synced ${matched} run${matched === 1 ? "" : "s"} from Strava.`
          : "No new runs matched your training window."
      );
    } catch {
      setSyncMessage("Couldn't reach Strava. Try again in a moment.");
    } finally {
      setSyncing(false);
    }
  }, [plan, program, updatePlan]);

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
            <div className="flex flex-wrap gap-2">
              <button
                onClick={sync}
                disabled={syncing}
                className="hard-button focus-pouf rounded-sm bg-primary px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-60"
              >
                {syncing ? "Fetching runs…" : "Sync runs"}
              </button>
              <button
                onClick={disconnect}
                className="focus-pouf rounded-full border-2 border-outline px-4 py-2 text-sm font-bold text-ink-muted hover:bg-lilac"
              >
                Disconnect
              </button>
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

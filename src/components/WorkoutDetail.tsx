"use client";

import { useEffect, useState } from "react";
import type { ActivityDetail } from "@/app/api/strava/activity/[id]/route";
import { BoltIcon, MoodIcon } from "@/components/Icons";
import {
  formatDuration,
  formatPace,
  formatPacePerMile,
  paceSecondsPerMile,
} from "@/lib/pace";
import RouteReplay from "@/components/RouteReplay";
import { RunLog, logSeconds } from "@/lib/store";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border-2 border-outline bg-lilac px-3 py-2">
      <div className="font-display text-title tabular-nums text-primary-dark">
        {value}
      </div>
      <div className="text-meta font-medium text-ink-soft">{label}</div>
    </div>
  );
}

/** Per-mile splits, with each mile compared against the run's average. */
function Splits({ detail }: { detail: ActivityDetail }) {
  const avg = paceSecondsPerMile(detail.seconds, detail.miles);
  const fastest = Math.min(...detail.splits.map((s) => s.pace));
  const slowest = Math.max(...detail.splits.map((s) => s.pace));
  const span = Math.max(slowest - fastest, 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[19rem] border-separate border-spacing-y-1 text-body">
        <thead>
          <tr className="text-left text-meta uppercase tracking-wide text-ink-soft">
            <th className="pl-1 font-bold">Mile</th>
            <th className="font-bold">Pace</th>
            <th className="font-bold">vs avg</th>
            <th className="font-bold">Elev</th>
            {detail.splits.some((s) => s.heartRate) && (
              <th className="font-bold">HR</th>
            )}
          </tr>
        </thead>
        <tbody>
          {detail.splits.map((s) => {
            const delta = avg ? s.pace - avg : 0;
            // Longer bar = slower mile, so the shape reads like the effort felt.
            const width = ((s.pace - fastest) / span) * 100;
            return (
              <tr key={s.mile} className="bg-lilac">
                <td className="py-1.5 pl-2 font-bold tabular-nums">
                  {s.mile}
                  {s.miles < 0.95 && (
                    <span className="ml-1 font-normal text-ink-soft">
                      ({s.miles})
                    </span>
                  )}
                </td>
                <td className="py-1.5 font-semibold tabular-nums">
                  {formatPace(s.pace)}
                </td>
                <td className="py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-10 shrink-0 tabular-nums ${
                        delta < 0 ? "text-primary-dark" : "text-ink-soft"
                      }`}
                    >
                      {delta === 0
                        ? "even"
                        : `${delta < 0 ? "-" : "+"}${formatPace(Math.abs(delta))}`}
                    </span>
                    <span className="h-1.5 w-14 overflow-hidden border border-outline bg-ink-soft">
                      <span
                        className="block h-full bg-primary"
                        style={{ width: `${Math.max(4, width)}%` }}
                      />
                    </span>
                  </div>
                </td>
                <td className="py-1.5 tabular-nums text-ink-soft">
                  {s.elevationChange > 0 ? "+" : ""}
                  {s.elevationChange} ft
                </td>
                {detail.splits.some((x) => x.heartRate) && (
                  <td className="py-1.5 pr-2 tabular-nums text-ink-soft">
                    {s.heartRate ?? "–"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function WorkoutDetail({
  log,
  label,
  dateLabel,
  onClose,
}: {
  log: RunLog;
  label: string;
  dateLabel: string;
  onClose: () => void;
}) {
  const [fetched, setFetched] = useState<ActivityDetail | null>(null);
  const [realMaps, setRealMaps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = log.stravaActivityId;
  const sample = log.sampleDetail;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setRealMaps(Boolean(json?.maps?.configured)))
      .catch(() => setRealMaps(false));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!id || sample) return;
    let cancelled = false;
    fetch(`/api/strava/activity/${id}`)
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (r.ok) setFetched(json.activity);
        else if (json.error === "missing_scope")
          setError("Poodle Pacer needs permission to read your activities.");
        else if (json.error === "not_found")
          setError("That run is no longer on Strava.");
        else setError("Could not load the details from Strava.");
      })
      .catch(() => !cancelled && setError("Could not reach Strava."));
    return () => {
      cancelled = true;
    };
  }, [id, sample]);

  const seconds = logSeconds(log);
  const pace = paceSecondsPerMile(seconds, log.miles);

  // Seeded demo runs carry their own splits and route, since a demo account has
  // no Strava connection to fetch from.
  const detail: ActivityDetail | null =
    fetched ??
    (sample
      ? {
          id: 0,
          name: log.stravaName ?? label,
          startDate: "",
          miles: log.miles ?? 0,
          seconds: seconds ?? 0,
          elapsedSeconds: seconds ?? 0,
          elevationGain: log.elevationGain ?? 0,
          avgHeartRate: log.avgHeartRate,
          maxHeartRate: log.maxHeartRate,
          cadence: log.cadence,
          splits: sample.splits,
          polyline: sample.polyline,
        }
      : null);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${label} details`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-sm border-3 border-outline bg-surface p-5 shadow-hero sm:rounded-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="type-title truncate">
              {log.stravaName ?? label}
            </h2>
            <p className="text-meta text-ink-soft">
              {dateLabel} · {label}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="focus-pouf shrink-0 rounded-full border-2 border-outline px-2.5 py-1 text-sm text-ink-soft transition hover:bg-lilac"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Distance" value={log.miles ? `${log.miles} mi` : "–"} />
          <Stat label="Time" value={seconds ? formatDuration(seconds) : "–"} />
          <Stat label="Avg pace" value={formatPacePerMile(pace)} />
          <Stat
            label="Elevation"
            value={log.elevationGain ? `${log.elevationGain} ft` : "–"}
          />
          {log.avgHeartRate && (
            <Stat label="Avg HR" value={`${log.avgHeartRate} bpm`} />
          )}
          {log.maxHeartRate && (
            <Stat label="Max HR" value={`${log.maxHeartRate} bpm`} />
          )}
          {log.cadence && <Stat label="Cadence" value={`${log.cadence} spm`} />}
          {detail?.calories && (
            <Stat label="Calories" value={`${detail.calories}`} />
          )}
        </div>

        {log.feel && (
          // Same colour and same face as the picker in the calendar card, so
          // how the run felt reads the same wherever it appears.
          <p
            className={`mt-3 inline-flex items-center gap-1.5 rounded-full border-2 border-outline px-3 py-1 text-meta font-bold text-ink ${
              log.feel === "good"
                ? "bg-mood-good"
                : log.feel === "medium"
                  ? "bg-mood-okay"
                  : "bg-mood-rough"
            }`}
          >
            <MoodIcon mood={log.feel} size={14} />
            Felt{" "}
            {log.feel === "good" ? "good" : log.feel === "medium" ? "okay" : "rough"}
          </p>
        )}

        {!id && !sample && (
          <p className="mt-4 rounded-sm border-2 border-outline bg-lilac px-4 py-3 text-meta text-ink-muted">
            This one was logged by hand, so there is no route or mile breakdown.
            Runs imported from Strava show both.
          </p>
        )}

        {id && !detail && !error && (
          <p className="mt-4 text-xs text-foreground/50">Loading from Strava…</p>
        )}

        {error && (
          <p className="mt-4 rounded-sm border-2 border-outline bg-lilac px-4 py-3 text-meta text-ink">
            {error}
          </p>
        )}

        {detail && (
          <div className="mt-4 space-y-4">
            {detail.polyline ? (
              <RouteReplay
                polyline={detail.polyline}
                activityId={detail.id > 0 ? detail.id : undefined}
                miles={detail.miles}
                seconds={detail.seconds}
                tiles={realMaps}
              />
            ) : (
              <p className="rounded-sm border-2 border-outline bg-lilac px-4 py-3 text-meta text-ink-muted">
                No route recorded, so this was probably a treadmill run.
              </p>
            )}

            {detail.splits.length > 0 ? (
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-foreground/55">
                  Mile splits
                </h3>
                <Splits detail={detail} />
              </div>
            ) : (
              <p className="text-xs text-foreground/50">
                Strava did not record mile splits for this run.
              </p>
            )}

            {detail.id > 0 && (
            <a
              href={`https://www.strava.com/activities/${detail.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#fc4c02] hover:underline"
            >
              <BoltIcon size={13} />
              Open on Strava
            </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

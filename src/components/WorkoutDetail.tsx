"use client";

import { useEffect, useState } from "react";
import type { ActivityDetail } from "@/app/api/strava/activity/[id]/route";
import { BoltIcon, CheckIcon } from "@/components/Icons";
import {
  formatDuration,
  formatPace,
  formatPacePerMile,
  paceSecondsPerMile,
} from "@/lib/pace";
import { decodePolyline, polylineEndpoints, polylineToPath } from "@/lib/polyline";
import { RunLog, logSeconds } from "@/lib/store";

const MAP_W = 320;
const MAP_H = 200;

function RouteShape({ polyline }: { polyline: string }) {
  const points = decodePolyline(polyline);
  const path = polylineToPath(points, MAP_W, MAP_H);
  const ends = polylineEndpoints(points, MAP_W, MAP_H);
  if (!path || !ends) return null;

  return (
    <div className="rounded-2xl bg-poodle-cream p-2 ring-1 ring-poodle-fur">
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Shape of the route run"
      >
        <path
          d={path}
          fill="none"
          stroke="#2f6fed"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
        <circle cx={ends.start[0]} cy={ends.start[1]} r="5" fill="#fff" stroke="#1d4ed8" strokeWidth="2.5" />
        <circle cx={ends.end[0]} cy={ends.end[1]} r="5" fill="#1d4ed8" stroke="#fff" strokeWidth="2" />
      </svg>
      <p className="px-1 pb-0.5 pt-1 text-[10px] text-foreground/45">
        Route shape. Hollow marker is the start.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-poodle-cream px-3 py-2">
      <div className="text-sm font-extrabold tabular-nums text-headband-dark">
        {value}
      </div>
      <div className="text-[10px] font-medium text-foreground/55">{label}</div>
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
      <table className="w-full min-w-[19rem] border-separate border-spacing-y-1 text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-foreground/45">
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
              <tr key={s.mile} className="bg-poodle-cream/60">
                <td className="rounded-l-lg py-1.5 pl-2 font-bold tabular-nums">
                  {s.mile}
                  {s.miles < 0.95 && (
                    <span className="ml-1 font-normal text-foreground/40">
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
                        delta < 0 ? "text-emerald-600" : "text-foreground/55"
                      }`}
                    >
                      {delta === 0
                        ? "even"
                        : `${delta < 0 ? "-" : "+"}${formatPace(Math.abs(delta))}`}
                    </span>
                    <span className="h-1.5 w-14 overflow-hidden rounded-full bg-poodle-fur/50">
                      <span
                        className="block h-full rounded-full bg-headband"
                        style={{ width: `${Math.max(4, width)}%` }}
                      />
                    </span>
                  </div>
                </td>
                <td className="py-1.5 tabular-nums text-foreground/60">
                  {s.elevationChange > 0 ? "+" : ""}
                  {s.elevationChange} ft
                </td>
                {detail.splits.some((x) => x.heartRate) && (
                  <td className="rounded-r-lg py-1.5 pr-2 tabular-nums text-foreground/60">
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
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = log.stravaActivityId;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`/api/strava/activity/${id}`)
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (r.ok) setDetail(json.activity);
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
  }, [id]);

  const seconds = logSeconds(log);
  const pace = paceSecondsPerMile(seconds, log.miles);

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
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-pouf bg-poodle-white p-5 ring-1 ring-poodle-fur pouf-shadow sm:rounded-pouf"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold tracking-tight">
              {log.stravaName ?? label}
            </h2>
            <p className="text-xs text-foreground/55">
              {dateLabel} · {label}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full px-2.5 py-1 text-sm text-foreground/50 ring-1 ring-poodle-fur transition hover:bg-poodle-cream"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-headband-light px-3 py-1 text-xs font-semibold text-headband-dark">
            <CheckIcon size={11} />
            Felt{" "}
            {log.feel === "good" ? "good" : log.feel === "medium" ? "okay" : "rough"}
          </p>
        )}

        {!id && (
          <p className="mt-4 rounded-xl bg-poodle-cream px-4 py-3 text-xs text-foreground/60">
            This one was logged by hand, so there is no route or mile breakdown.
            Runs imported from Strava show both.
          </p>
        )}

        {id && !detail && !error && (
          <p className="mt-4 text-xs text-foreground/50">Loading from Strava…</p>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800 ring-1 ring-amber-200">
            {error}
          </p>
        )}

        {detail && (
          <div className="mt-4 space-y-4">
            {detail.polyline ? (
              <RouteShape polyline={detail.polyline} />
            ) : (
              <p className="rounded-xl bg-poodle-cream px-4 py-3 text-xs text-foreground/60">
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

            <a
              href={`https://www.strava.com/activities/${detail.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#fc4c02] hover:underline"
            >
              <BoltIcon size={13} />
              Open on Strava
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  MetricScope,
  PeriodStats,
  SCOPE_LABELS,
  TrendPoint,
  computeInsights,
} from "@/lib/insights";
import {
  formatDuration,
  formatPace,
  formatPacePerMile,
  paceDelta,
} from "@/lib/pace";
import { Program } from "@/lib/programs";
import { Plan } from "@/lib/store";

const SCOPES: MetricScope[] = ["week", "month", "plan"];

function Tile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : "text-headband-dark";
  return (
    <div className="rounded-pouf bg-poodle-white p-3 text-center ring-1 ring-poodle-fur pouf-shadow">
      <div className={`text-lg font-extrabold tabular-nums ${toneClass}`}>
        {value}
      </div>
      <div className="text-[11px] font-medium text-foreground/60">{label}</div>
      {sub && (
        <div className="mt-0.5 text-[10px] font-medium text-foreground/45">
          {sub}
        </div>
      )}
    </div>
  );
}

/** Miles as bars with average pace overlaid as a line. */
function TrendChart({ points }: { points: TrendPoint[] }) {
  const width = 640;
  const height = 150;
  const padX = 8;
  const padTop = 12;
  const padBottom = 22;

  const maxMiles = Math.max(...points.map((p) => p.miles), 1);
  const paced = points.filter((p) => p.pace !== undefined);
  const minPace = Math.min(...paced.map((p) => p.pace!));
  const maxPace = Math.max(...paced.map((p) => p.pace!));
  const paceRange = Math.max(maxPace - minPace, 1);

  const slot = (width - padX * 2) / points.length;
  const barW = Math.min(slot * 0.6, 46);
  const plotH = height - padTop - padBottom;

  const x = (i: number) => padX + slot * i + slot / 2;
  const yMiles = (m: number) => padTop + plotH - (m / maxMiles) * plotH;
  // Faster pace (fewer seconds) sits higher.
  const yPace = (p: number) =>
    padTop + ((p - minPace) / paceRange) * plotH * 0.75 + plotH * 0.1;

  const paceLine = paced
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(points.indexOf(p))} ${yPace(p.pace!)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[150px] w-full min-w-[420px]"
        role="img"
        aria-label="Mileage bars with average pace trend"
      >
        {points.map((p, i) => (
          <g key={`${p.label}-${i}`}>
            <rect
              x={x(i) - barW / 2}
              y={yMiles(p.miles)}
              width={barW}
              height={Math.max(padTop + plotH - yMiles(p.miles), 0)}
              rx="5"
              fill="#dbe7ff"
            />
            <text
              x={x(i)}
              y={height - 8}
              textAnchor="middle"
              fontSize="10"
              fill="currentColor"
              opacity="0.5"
            >
              {p.label}
            </text>
            {p.miles > 0 && (
              <text
                x={x(i)}
                y={yMiles(p.miles) - 3}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="#1d4ed8"
                opacity="0.75"
              >
                {p.miles}
              </text>
            )}
          </g>
        ))}

        {paced.length > 1 && (
          <path
            d={paceLine}
            fill="none"
            stroke="#2f6fed"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {paced.map((p, i) => (
          <circle
            key={`pace-${i}`}
            cx={x(points.indexOf(p))}
            cy={yPace(p.pace!)}
            r="3.5"
            fill="#fff"
            stroke="#2f6fed"
            strokeWidth="2"
          >
            <title>{`${p.label} · ${formatPacePerMile(p.pace)}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

function paceTone(delta: ReturnType<typeof paceDelta>) {
  if (!delta || delta.seconds < 1) return "default" as const;
  return delta.faster ? ("good" as const) : ("warn" as const);
}

function paceSub(delta: ReturnType<typeof paceDelta>, scope: MetricScope) {
  if (!delta || delta.seconds < 1) return undefined;
  const period = scope === "week" ? "last week" : "last month";
  return `${delta.faster ? "▼" : "▲"} ${formatPace(delta.seconds)} vs ${period}`;
}

function completionTone(s: PeriodStats) {
  if (s.scheduled === 0) return "default" as const;
  const rate = s.completed / s.scheduled;
  return rate >= 0.8 ? ("good" as const) : rate >= 0.5 ? ("default" as const) : ("warn" as const);
}

export default function InsightsPanel({
  plan,
  program,
}: {
  plan: Plan;
  program: Program;
}) {
  const [scope, setScope] = useState<MetricScope>("week");
  const insights = useMemo(
    () => computeInsights(plan, program, scope),
    [plan, program, scope]
  );

  if (!insights) {
    return (
      <section className="mt-4 rounded-pouf bg-poodle-white p-5 ring-1 ring-poodle-fur pouf-shadow">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground/60">
          📈 Performance
        </h2>
        <p className="mt-2 text-sm text-foreground/60">
          Set a race date to start tracking pace, mileage, and heart-rate trends.
        </p>
      </section>
    );
  }

  const { current, previous, trend } = insights;
  const delta = paceDelta(current.avgPace, previous?.avgPace);

  const hasHeartRate = current.avgHeartRate !== undefined;
  const hasElevation = current.elevationGain > 0;
  const hasCadence = current.avgCadence !== undefined;

  return (
    <section className="mt-4 rounded-pouf bg-poodle-white p-4 ring-1 ring-poodle-fur pouf-shadow sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground/60">
          📈 Performance
        </h2>
        <div className="inline-flex rounded-full bg-poodle-cream p-1 ring-1 ring-poodle-fur">
          {SCOPES.map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              aria-pressed={scope === s}
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                scope === s
                  ? "bg-headband text-white"
                  : "text-foreground/60 hover:text-headband-dark"
              }`}
            >
              {SCOPE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <Tile
          label="Miles"
          value={`${current.miles}`}
          sub={
            current.plannedMiles > 0
              ? `of ${current.plannedMiles} planned`
              : undefined
          }
        />
        <Tile
          label="Avg pace"
          value={formatPacePerMile(current.avgPace)}
          sub={paceSub(delta, scope)}
          tone={paceTone(delta)}
        />
        <Tile
          label="Time on feet"
          value={current.seconds > 0 ? formatDuration(current.seconds) : "—"}
          sub={
            current.runCount > 0
              ? `${current.runCount} run${current.runCount === 1 ? "" : "s"}`
              : undefined
          }
        />
        <Tile
          label="Completed"
          value={`${current.completed}/${current.scheduled}`}
          sub={
            current.scheduled > 0
              ? `${Math.round((current.completed / current.scheduled) * 100)}% consistency`
              : undefined
          }
          tone={completionTone(current)}
        />
        <Tile
          label="Longest run"
          value={current.longestRun > 0 ? `${current.longestRun} mi` : "—"}
        />
        {hasHeartRate && (
          <Tile
            label="Avg heart rate"
            value={`${current.avgHeartRate} bpm`}
            sub={current.maxHeartRate ? `max ${current.maxHeartRate}` : undefined}
          />
        )}
        {hasElevation && (
          <Tile label="Elevation gain" value={`${current.elevationGain} ft`} />
        )}
        {hasCadence && (
          <Tile label="Avg cadence" value={`${current.avgCadence} spm`} />
        )}
      </div>

      {trend.length > 0 ? (
        <div className="mt-4">
          <div className="flex items-center gap-4 text-[11px] font-medium text-foreground/55">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm bg-[#dbe7ff]" />
              Miles
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-3 rounded-full bg-headband" />
              Avg pace (higher = faster)
            </span>
          </div>
          <TrendChart points={trend} />
        </div>
      ) : (
        <p className="mt-4 text-xs text-foreground/50">
          Log a run — or connect Strava — to see pace and mileage trends here.
        </p>
      )}

      {!hasHeartRate && (
        <p className="mt-3 text-[11px] text-foreground/45">
          Heart rate, elevation, and cadence appear once runs are imported from
          Strava.
        </p>
      )}
    </section>
  );
}

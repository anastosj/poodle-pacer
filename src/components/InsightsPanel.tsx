"use client";

import { useMemo, useState } from "react";
import {
  MetricScope,
  PeriodStats,
  SCOPE_LABELS,
  TrendPoint,
  computeInsights,
  consistencyOf,
} from "@/lib/insights";
import {
  formatDuration,
  formatPace,
  formatPacePerMile,
  paceDelta,
} from "@/lib/pace";
import { Program } from "@/lib/programs";
import { Plan, SyncedRun } from "@/lib/store";

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
        ? "text-primary-dark"
      : tone === "warn"
        ? "text-accent"
        : "text-primary-dark";
  return (
    <div className="rounded-sm border-2 border-outline bg-surface p-3 text-center shadow-soft pouf-lift">
      <div className={`font-display text-title tabular-nums ${toneClass}`}>
        {value}
      </div>
      <div className="text-meta font-bold uppercase text-ink-soft">{label}</div>
      {sub && (
        <div className="mt-0.5 text-meta font-medium text-ink-soft">
          {sub}
        </div>
      )}
    </div>
  );
}

/** Miles as bars with average pace overlaid as a line. */
function TrendChart({ points }: { points: TrendPoint[] }) {
  /*
   * Pace used to be readable only from a <title> on the 3.5px dots, which is
   * not a hit target anyone finds. The whole column is now hoverable, and
   * focusable so the numbers are reachable from the keyboard too.
   */
  const [active, setActive] = useState<number | null>(null);
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
    <div className="relative overflow-x-auto">
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
              fill="var(--periwinkle)"
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
                fill="var(--primary-dark)"
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
            stroke="var(--primary)"
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
            r={active === points.indexOf(p) ? 5 : 3.5}
            fill="var(--surface)"
            stroke="var(--primary)"
            strokeWidth="2"
          />
        ))}

        {/* Full-height hit targets, so the whole column answers the hover. */}
        {points.map((p, i) => (
          <rect
            key={`hit-${p.label}-${i}`}
            x={x(i) - slot / 2}
            y={0}
            width={slot}
            height={height}
            fill={active === i ? "var(--primary)" : "transparent"}
            opacity={active === i ? 0.07 : 1}
            tabIndex={0}
            role="button"
            aria-label={`${p.label}: ${p.miles} miles${
              p.pace !== undefined ? `, ${formatPacePerMile(p.pace)}` : ""
            }${p.avgHeartRate ? `, ${p.avgHeartRate} bpm average` : ""}`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive((a) => (a === i ? null : a))}
            onFocus={() => setActive(i)}
            onBlur={() => setActive((a) => (a === i ? null : a))}
            className="cursor-pointer focus:outline-none"
          />
        ))}
      </svg>

      {active !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-sm border-2 border-outline bg-surface px-2 py-1 text-meta shadow-card"
          style={{ left: `${(x(active) / width) * 100}%` }}
        >
          <div className="font-bold text-ink">{points[active].label}</div>
          <div className="tabular-nums text-ink-soft">
            {points[active].miles} mi
            {points[active].pace !== undefined && (
              <> · {formatPacePerMile(points[active].pace)}</>
            )}
          </div>
          {points[active].avgHeartRate && (
            <div className="tabular-nums text-ink-soft">
              {points[active].avgHeartRate} bpm
            </div>
          )}
        </div>
      )}
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
  if (s.due === 0) return "default" as const;
  const rate = consistencyOf(s);
  return rate >= 0.8 ? ("good" as const) : rate >= 0.5 ? ("default" as const) : ("warn" as const);
}

export default function InsightsPanel({
  plan,
  program,
  runs = [],
}: {
  plan: Plan;
  program: Program;
  runs?: SyncedRun[];
}) {
  // A month in, rather than a week: early in a plan, and on any week with a
  // couple of rest days, the weekly view opens on almost no data.
  const [scope, setScope] = useState<MetricScope>("month");
  // Four tiles answer "how is it going"; the rest are detail worth a click.
  const [expanded, setExpanded] = useState(false);
  const insights = useMemo(
    () => computeInsights(plan, program, scope, runs),
    [plan, program, scope, runs]
  );

  if (!insights) {
    return (
      <section className="mt-4 rounded-sm border-3 border-outline bg-surface p-5 shadow-card">
        <h2 className="type-overline text-ink-soft">
          Performance
        </h2>
        <p className="mt-2 type-body text-ink-muted">
          Sync a run or set a race date to start tracking pace, mileage, and
          heart-rate trends.
        </p>
      </section>
    );
  }

  const { current, previous, trend } = insights;
  const delta = paceDelta(current.avgPace, previous?.avgPace);

  const hasHeartRate = current.avgHeartRate !== undefined;
  const hasElevation = current.elevationGain > 0;
  const hasCadence = current.avgCadence !== undefined;
  const extraCount =
    1 + [hasHeartRate, hasElevation, hasCadence].filter(Boolean).length;

  return (
    <section className="mt-4 flex flex-col rounded-sm border-3 border-outline bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="type-overline text-ink-soft">
          Performance
        </h2>
        <div className="inline-flex rounded-full border-2 border-outline bg-lilac p-1">
          {SCOPES.map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              aria-pressed={scope === s}
              className={`focus-pouf rounded-full px-3 py-1 text-meta font-bold transition ${
                scope === s
                  ? "bg-ink text-highlight"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {SCOPE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
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
          value={current.seconds > 0 ? formatDuration(current.seconds) : "–"}
          sub={
            current.runCount > 0
              ? `${current.runCount} run${current.runCount === 1 ? "" : "s"}`
              : undefined
          }
        />
        <Tile
          label="Completed"
          value={
            current.due > 0
              ? `${current.completed}/${current.due}`
              : `0/0`
          }
          sub={
            current.due > 0
              ? `${Math.round(consistencyOf(current) * 100)}% consistency`
              : "nothing due yet"
          }
          tone={completionTone(current)}
        />
        {expanded && (
          <>
            <Tile
              label="Longest run"
              value={current.longestRun > 0 ? `${current.longestRun} mi` : "–"}
            />
            {hasHeartRate && (
              <Tile
                label="Avg heart rate"
                value={`${current.avgHeartRate} bpm`}
                sub={
                  current.maxHeartRate ? `max ${current.maxHeartRate}` : undefined
                }
              />
            )}
            {hasElevation && (
              <Tile label="Elevation gain" value={`${current.elevationGain} ft`} />
            )}
            {hasCadence && (
              <Tile label="Avg cadence" value={`${current.avgCadence} spm`} />
            )}
          </>
        )}
      </div>

      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="focus-pouf mt-2 self-start rounded-full border-2 border-outline px-3 py-1 text-meta font-bold text-primary-dark transition hover:bg-lilac"
      >
        {expanded ? "Fewer metrics" : `More metrics (${extraCount})`}
      </button>

      {trend.length > 1 ? (
        <div className="mt-4">
          <div className="flex items-center gap-4 text-meta font-medium text-ink-soft">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 border-2 border-outline bg-periwinkle" />
              Miles
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-3 bg-primary" />
              Avg pace (higher = faster)
            </span>
          </div>
          <TrendChart points={trend} />
        </div>
      ) : (
        <p className="mt-4 text-meta text-ink-soft">
          Log a run, or connect Strava, to see pace and mileage trends here.
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

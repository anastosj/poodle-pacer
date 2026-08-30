"use client";

import { useMemo, useState } from "react";
import {
  MetricScope,
  PeriodStats,
  SCOPE_LABELS,
  computeInsights,
  consistencyOf,
} from "@/lib/insights";
import {
  ActivityKind,
  KIND_LABEL,
  KIND_NOUN,
  TRACKED_KINDS,
  defaultKind,
  distanceLabel,
  formatDistance,
  formatSpeed,
  kindsPresent,
  speedLabel,
  tracksDistance,
} from "@/lib/activities";
import { formatDuration, formatPace, paceDelta } from "@/lib/pace";
import PaceTrendChart from "@/components/PaceTrendChart";
import { planCells } from "@/lib/calendar";
import { Program, programSports } from "@/lib/programs";

/** A program discipline, as the activity kind it corresponds to. */
const SPORT_KIND: Record<"running" | "cycling" | "swimming", ActivityKind> = {
  running: "run",
  cycling: "ride",
  swimming: "swim",
};
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

function paceTone(delta: ReturnType<typeof paceDelta>) {
  if (!delta || delta.seconds < 1) return "default" as const;
  return delta.faster ? ("good" as const) : ("warn" as const);
}

/**
 * How the speed moved, in the unit the tile above it is showing: a time gap
 * for pace-based sports, an mph gap for riding.
 */
function paceSub(
  delta: ReturnType<typeof paceDelta>,
  scope: MetricScope,
  kind: ActivityKind,
  current?: number,
  previous?: number
) {
  if (!delta || delta.seconds < 1) return undefined;
  const period = scope === "week" ? "last week" : "last month";
  const arrow = delta.faster ? "▼" : "▲";
  if (kind === "ride" && current && previous) {
    const mph = Math.abs(3600 / current - 3600 / previous);
    if (mph < 0.05) return undefined;
    return `${arrow} ${mph.toFixed(1)} mph vs ${period}`;
  }
  return `${arrow} ${formatPace(delta.seconds)} vs ${period}`;
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

  /*
   * A running plan is about running, so it opens there and offers no choice
   * unless other sports have actually been logged. Triathlon plans and runners
   * with no plan open on whatever they have been doing most.
   */
  const planIsRunning = Boolean(plan.startDate) && program.category === "running";

  /*
   * What counts as "a sport this runner does" is both what they synced and what
   * they ticked off in the plan. A triathlete logging by hand has no synced
   * activities at all, and would otherwise be offered no choice of discipline.
   */
  const done = useMemo(() => {
    const list = runs.map((r) => ({ sportType: r.sportType, date: r.date }));
    if (plan.startDate) {
      for (const cell of planCells(program, plan)) {
        const log = plan.logs[cell.key];
        if (log?.completed) list.push({ sportType: log.sportType, date: cell.iso });
      }
    }
    return list;
  }, [runs, plan, program]);

  // A plan's own disciplines are offered from day one, logged or not: a
  // triathlon plan is three sports whether or not week 1 has happened.
  const available = useMemo(() => {
    const fromPlan = plan.startDate
      ? programSports(program).map((sport) => SPORT_KIND[sport])
      : [];
    const all = new Set([...kindsPresent(done), ...fromPlan]);
    return TRACKED_KINDS.filter((k) => all.has(k));
  }, [done, plan.startDate, program]);

  const opening = useMemo(
    () => defaultKind(done, planIsRunning),
    [done, planIsRunning]
  );
  const [chosen, setChosen] = useState<ActivityKind | null>(null);
  const kind = chosen ?? opening;

  const insights = useMemo(
    () => computeInsights(plan, program, scope, runs, kind),
    [plan, program, scope, runs, kind]
  );

  const noun = KIND_NOUN[kind];
  const showsDistance = tracksDistance(kind);

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

  // The trend chart drops points with no recorded duration, so the "not enough
  // data yet" message has to count the same points the chart will actually draw.
  const pacedPoints = trend.filter((p) => p.pace !== undefined).length;
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

      {/* Only worth asking which sport when more than one has been logged. */}
      {available.length > 1 && (
        <div className="mt-3 inline-flex flex-wrap gap-1 rounded-full border-2 border-outline bg-lilac p-1">
          {available.map((k) => (
            <button
              key={k}
              onClick={() => setChosen(k)}
              aria-pressed={kind === k}
              className={`focus-pouf rounded-full px-3 py-1 text-meta font-bold transition ${
                kind === k
                  ? "bg-ink text-highlight"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {showsDistance && (
          <Tile
            label={distanceLabel(kind)}
            value={
              kind === "swim"
                ? Math.round(current.miles * 1760).toLocaleString("en-US")
                : `${Math.round(current.miles * 10) / 10}`
            }
            sub={
              current.plannedMiles > 0
                ? `of ${Math.round(current.plannedMiles * 10) / 10} planned`
                : undefined
            }
          />
        )}
        <Tile
          label={speedLabel(kind)}
          value={formatSpeed(kind, 1, current.avgPace) ?? "–"}
          sub={paceSub(delta, scope, kind, current.avgPace, previous?.avgPace)}
          tone={paceTone(delta)}
        />
        <Tile
          label={kind === "run" ? "Time on feet" : "Time"}
          value={current.seconds > 0 ? formatDuration(current.seconds) : "–"}
          sub={
            current.runCount > 0
              ? `${current.runCount} ${noun}${current.runCount === 1 ? "" : "s"}`
              : undefined
          }
        />
        {/* Only the plan's own sport has anything scheduled to complete. */}
        {current.scheduled > 0 && (
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
        )}
        {expanded && (
          <>
            {showsDistance && (
              <Tile
                label={`Longest ${noun}`}
                value={formatDistance(kind, current.longestRun) ?? "–"}
              />
            )}
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

      {pacedPoints > 1 ? (
        <div className="mt-4">
          <div className="flex items-center gap-4 text-meta font-medium text-ink-soft">
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-3 bg-primary" />
              {speedLabel(kind)} (higher = faster)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-3 bg-accent" />
              {distanceLabel(kind)}
            </span>
          </div>
          <PaceTrendChart points={trend} kind={kind} />
        </div>
      ) : (
        <p className="mt-4 text-meta text-ink-soft">
          Log {kind === "run" ? "a run" : `a ${noun}`}, or connect Strava, to
          see trends here.
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

"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  HeatmapCells,
  HeatmapChart,
  type HeatmapColumn,
  type HeatmapLevelColors,
  HeatmapLegend,
  HeatmapTooltip,
  HeatmapXAxis,
  HeatmapYAxis,
  getHeatmapWeekStartSunday,
} from "@/components/charts/heatmap";
import {
  ActivityKind,
  KIND_NOUN,
  activityKind,
  formatDistance,
} from "@/lib/activities";
import { planCells } from "@/lib/calendar";
import { addDays, startOfToday, toLocalISO } from "@/lib/dates";
import { Program, Workout, workoutSportType, yardsToMiles } from "@/lib/programs";
import { Plan, SyncedRun, logSeconds } from "@/lib/store";

/** Cell pitch (gap included), gap, and plot margins. */
const CELL = 14;
const GAP = 3;
const MARGIN = { top: 24, right: 8, bottom: 4, left: 32 };
const MS_PER_WEEK = 7 * 86400000;

const RAMP: HeatmapLevelColors = [
  "var(--chart-scale-01)",
  "var(--chart-scale-02)",
  "var(--chart-scale-03)",
  "var(--chart-scale-04)",
  "var(--chart-scale-05)",
];

/**
 * A day's training as equivalent running miles, so one colour scale can speak
 * for all three sports.
 *
 * The ratios are the ones multisport training has long used: three miles on a
 * bike ask about what one on foot does, and a mile swum asks about four.
 * Walking is on foot but far cheaper per mile. Without this a 20-mile ride and
 * a 20-mile run paint the same square, which is the opposite of useful.
 */
const EQUIVALENT_MILES_PER_MILE: Record<ActivityKind, number> = {
  run: 1,
  ride: 1 / 3,
  swim: 4,
  walk: 0.5,
  other: 0,
};

/**
 * What a session with no distance is worth. Strength and yoga are logged as
 * time only, and crediting them nothing would paint a real training day as
 * rest. Ten minutes to the equivalent mile is an easy run's rate.
 */
const SECONDS_PER_EQUIVALENT_MILE = 600;

function equivalentMiles(
  kind: ActivityKind,
  miles: number | undefined,
  seconds: number | undefined
): number {
  const factor = EQUIVALENT_MILES_PER_MILE[kind];
  if (factor > 0 && miles && miles > 0) return miles * factor;
  if (seconds && seconds > 0) return seconds / SECONDS_PER_EQUIVALENT_MILE;
  return 0;
}

/**
 * Level thresholds, in equivalent miles. These have to be levels rather than
 * raw volume: the grid colours a cell by `getHeatmapContributionLevel`, which
 * matches whole numbers exactly (1, 2, 3) and sends everything else to the top
 * of the scale — so a day of 3.5 miles and a day of 20 would paint identically.
 * Passing the level as the count sidesteps that; the real figure is looked up
 * by date for the tooltip.
 */
function levelOfVolume(equivalent: number): number {
  if (equivalent <= 0) return 0;
  if (equivalent < 3) return 1;
  if (equivalent < 5) return 2;
  if (equivalent < 8) return 3;
  return 4;
}

/** Planned distance in miles, whichever unit the workout happens to store. */
function plannedMiles(workout: Workout): number {
  if (typeof workout.miles === "number") return workout.miles;
  if (typeof workout.yards === "number") return yardsToMiles(workout.yards);
  // Bikes and cross-training are prescribed in minutes, not distance.
  return 0;
}

interface DayTotal {
  equivalent: number;
  /** One phrase per session, e.g. "4.2 mi run", for the tooltip. */
  parts: string[];
  /**
   * True once anything but a plain run is in the day, so the tooltip knows to
   * show the conversion. Without it a 24-mile ride reads as a huge day next to
   * a dark square with no explanation of how one became the other.
   */
  translated: boolean;
}

/** Training volume per day across the current calendar year, Jan 1 to Dec 31. */
export default function TrainingHeatmap({
  plan,
  program,
  runs = [],
}: {
  plan: Plan;
  program: Program;
  runs?: SyncedRun[];
}) {
  const year = startOfToday().getFullYear();
  /*
   * Columns are built Sun-first and rotated to read Mon–Sun, so the grid opens
   * on the Sunday at or before Jan 1 and closes on the Saturday at or after
   * Dec 31. That makes the first and last columns straddle the year boundary
   * — see the count rule below.
   */
  const gridStart = useMemo(
    () => getHeatmapWeekStartSunday(new Date(year, 0, 1)),
    [year]
  );

  const { columns, byDay } = useMemo(() => {
    const totals = new Map<string, DayTotal>();
    const add = (
      iso: string,
      kind: ActivityKind,
      miles: number | undefined,
      seconds: number | undefined
    ) => {
      const equivalent = equivalentMiles(kind, miles, seconds);
      if (equivalent <= 0) return;
      const entry = totals.get(iso) ?? {
        equivalent: 0,
        parts: [],
        translated: false,
      };
      entry.equivalent += equivalent;
      if (kind !== "run") entry.translated = true;
      const distance = formatDistance(kind, miles);
      entry.parts.push(
        distance
          ? `${distance} ${KIND_NOUN[kind]}`
          : `${Math.round((seconds ?? 0) / 60)} min ${KIND_NOUN[kind]}`
      );
      totals.set(iso, entry);
    };

    for (const cell of planCells(program, plan)) {
      const log = plan.logs[cell.key];
      if (!log?.completed) continue;
      /*
       * What actually filled the slot, falling back to what was prescribed.
       * `activityKind` reads a missing sport as running, which is right for
       * activities synced before the field existed but wrong here: a cross
       * slot is explicitly not a run, and a pool session logged into one was
       * being reported as a 60 minute run. With nothing recorded, "session"
       * is the honest answer.
       */
      const sport = log.sportType ?? workoutSportType(cell.workout);
      const kind: ActivityKind = sport ? activityKind(sport) : "other";
      add(
        cell.iso,
        kind,
        log.miles ?? plannedMiles(cell.workout),
        logSeconds(log) ??
          (cell.workout.minutes ? cell.workout.minutes * 60 : undefined)
      );
    }
    // Synced runs already matched to a plan slot carry the same Strava id as
    // the log above, so skip those to avoid double-counting the day.
    const claimed = new Set(
      Object.values(plan.logs)
        .map((l) => l.stravaActivityId)
        .filter((id): id is number => typeof id === "number")
    );
    for (const run of runs) {
      if (claimed.has(run.stravaActivityId)) continue;
      add(run.date, activityKind(run.sportType), run.miles, run.seconds);
    }

    const yearEnd = new Date(year, 11, 31);
    const out: HeatmapColumn[] = [];
    for (
      let week = gridStart, col = 0;
      week <= yearEnd;
      week = addDays(week, 7), col += 1
    ) {
      out.push({
        bin: col,
        bins: Array.from({ length: 7 }, (_, day) => {
          const date = addDays(week, day);
          /*
           * Days belonging to the neighbouring years still occupy their square
           * — the columns have to stay seven tall — but never carry a count.
           * December's last runs therefore cannot leak into this year's total.
           */
          const inYear = date.getFullYear() === year;
          const total = inYear ? totals.get(toLocalISO(date)) : undefined;
          return {
            bin: day,
            date,
            count: levelOfVolume(total?.equivalent ?? 0),
          };
        }),
      });
    }
    return { columns: out, byDay: totals };
  }, [plan, program, runs, year, gridStart]);

  /*
   * A year is about 780px of grid, which is wider than a phone. Open on the
   * current week rather than on January, so the view lands where training is
   * actually happening instead of on months of empty squares.
   */
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const column = Math.floor(
      (startOfToday().getTime() - gridStart.getTime()) / MS_PER_WEEK
    );
    el.scrollLeft = Math.max(
      0,
      MARGIN.left + column * CELL - el.clientWidth / 2
    );
  }, [gridStart, columns.length]);

  let total = 0;
  for (const [iso, day] of byDay) {
    if (iso.startsWith(String(year))) total += day.equivalent;
  }

  // An all-blank year says nothing. Wait until there is something to show.
  if (total === 0) return null;

  /*
   * The grid measures itself from its container, but a shrink-to-fit container
   * measures itself from the grid — which resolved to about ten columns wide
   * and stacked the rest on top of each other. Sizing the wrapper from the
   * column count breaks the loop; these numbers mirror the props below.
   */
  const width = MARGIN.left + MARGIN.right + columns.length * CELL;

  return (
    <section className="mt-4 rounded-sm border-3 border-outline bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="type-overline text-ink-soft">Training heatmap</h2>
        <span className="text-meta tabular-nums text-ink-soft">
          {year} · {Math.round(total)} equivalent miles
        </span>
      </div>

      <div ref={scrollRef} className="mt-3 overflow-x-auto">
        {/*
          * Cell size is pinned rather than fluid: left to derive squares from
          * the container width, the year produced tiles that dwarfed every
          * other card on the page. Fixed cells keep the grid at a calendar's
          * scale and let the row scroll instead of inflating.
          */}
        <div style={{ width }}>
          <HeatmapChart
            data={columns}
            layout="fluid"
            weekStartDay={1}
            binSize={CELL}
            gap={GAP}
            levelColors={RAMP}
            margin={MARGIN}
          >
            <HeatmapXAxis className="text-meta" />
            <HeatmapYAxis className="text-meta" labelFormat="initial" />
            <HeatmapCells cornerRadius={2} />
            <HeatmapTooltip
              formatLabel={(_level, date) => {
                const day = byDay.get(toLocalISO(date));
                if (!day) return "Rest day";
                const summary = day.parts.join(" + ");
                // A run already is its own scale. Anything else — or any mix —
                // needs the conversion shown, or the colour looks arbitrary.
                return day.translated || day.parts.length > 1
                  ? `${summary} · ${Math.round(day.equivalent * 10) / 10} eq mi`
                  : summary;
              }}
            />
          </HeatmapChart>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-meta text-ink-soft">
          Rides and swims are scaled to running miles.
        </p>
        <HeatmapLegend />
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  HeatmapCells,
  HeatmapChart,
  type HeatmapColumn,
  HeatmapLegend,
  HeatmapTooltip,
  HeatmapXAxis,
  HeatmapYAxis,
  getHeatmapWeekStartSunday,
} from "@/components/charts/heatmap";
import { planCells } from "@/lib/calendar";
import { addDays, startOfToday, toLocalISO } from "@/lib/dates";
import { Program } from "@/lib/programs";
import { Plan, SyncedRun } from "@/lib/store";

/*
 * Mile thresholds for the five-step ramp. The default contribution scale steps
 * at 1/2/3/4 events, which for a half-marathon plan would put every run past
 * week three in the top bucket and flatten the long-run rhythm the grid exists
 * to show. These break where a training week actually varies.
 */
function levelOfMiles(miles: number): number {
  if (miles <= 0) return 0;
  if (miles < 3) return 1;
  if (miles < 5) return 2;
  if (miles < 8) return 3;
  return 4;
}

/** Cell pitch (gap included), gap, and plot margins. */
const CELL = 14;
const GAP = 3;
const MARGIN = { top: 24, right: 8, bottom: 4, left: 32 };
const MS_PER_WEEK = 7 * 86400000;

const RAMP = [
  "var(--chart-scale-01)",
  "var(--chart-scale-02)",
  "var(--chart-scale-03)",
  "var(--chart-scale-04)",
  "var(--chart-scale-05)",
];

/** Miles logged per day across the current calendar year, Jan 1 to Dec 31. */
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
   * Columns are Sun–Sat, so the grid opens on the Sunday at or before Jan 1
   * and closes on the Saturday at or after Dec 31. That makes the first and
   * last columns straddle the year boundary — see the count rule below.
   */
  const gridStart = useMemo(
    () => getHeatmapWeekStartSunday(new Date(year, 0, 1)),
    [year]
  );

  const columns = useMemo<HeatmapColumn[]>(() => {
    // Distance per day, from ticked-off plan workouts and from synced
    // activities alike. A run that is both is written once, by ISO date.
    const byDay = new Map<string, number>();
    const add = (iso: string, miles: number) => {
      if (miles > 0) byDay.set(iso, (byDay.get(iso) ?? 0) + miles);
    };

    for (const cell of planCells(program, plan)) {
      const log = plan.logs[cell.key];
      if (!log?.completed) continue;
      add(cell.iso, log.miles ?? cell.workout.miles ?? 0);
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
      add(run.date, run.miles);
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
          const count =
            date.getFullYear() === year ? byDay.get(toLocalISO(date)) ?? 0 : 0;
          return { bin: day, date, count };
        }),
      });
    }
    return out;
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

  const total = columns.reduce(
    (sum, c) => sum + c.bins.reduce((s, b) => s + b.count, 0),
    0
  );

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
          {year} · {Math.round(total * 10) / 10} miles logged
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
            weekStartDay={0}
            binSize={CELL}
            gap={GAP}
            colorScale={(count) => RAMP[levelOfMiles(count ?? 0)]}
            margin={MARGIN}
          >
            <HeatmapXAxis className="text-meta" />
            <HeatmapYAxis className="text-meta" labelFormat="initial" />
            <HeatmapCells cornerRadius={2} />
            <HeatmapTooltip
              formatLabel={(count) =>
                count > 0 ? `${Math.round(count * 10) / 10} mi` : "Rest day"
              }
            />
          </HeatmapChart>
        </div>
      </div>

      <div className="mt-2 flex justify-end">
        <HeatmapLegend />
      </div>
    </section>
  );
}

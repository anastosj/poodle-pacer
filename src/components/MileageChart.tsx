"use client";

import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { runningMilesFor } from "@/lib/mileage";
import { Program, workoutTracksRunningMiles } from "@/lib/programs";
import { formatPacePerMile, paceSecondsPerMile } from "@/lib/pace";
import { Plan, beginWeekOf, logKey, logSeconds } from "@/lib/store";

function currentWeek(plan: Plan, program: Program): number | null {
  if (!plan.startDate) return null;
  const start = new Date(plan.startDate + "T00:00:00");
  const diffDays = Math.floor((Date.now() - start.getTime()) / 86400000);
  if (diffDays < 0) return null;
  const week = Math.floor(diffDays / 7) + 1;
  return week <= program.weeks ? week : null;
}

export default function MileageChart({
  plan,
  program,
}: {
  plan: Plan;
  program: Program;
}) {
  const nowWeek = currentWeek(plan, program);
  const weeks = program.schedule
    .filter((week) => week.week >= beginWeekOf(plan))
    .map((week) => {
      let planned = 0;
      let logged = 0;
      // Only time that covered distance, so a cross-training hour cannot drag
      // the week's pace out. Same rule the Performance panel uses.
      let seconds = 0;
      week.days.forEach((day, i) => {
        const plannedMiles = workoutTracksRunningMiles(day)
          ? day.miles ?? 0
          : 0;
        planned += plannedMiles;
        const log = plan.logs[logKey(week.week, i)];
        // A ride or a strength session can fill a run-or-cross day; its
        // distance is not running mileage, so the bar must not grow for it.
        const miles = runningMilesFor(day, log);
        if (miles > 0) {
          logged += miles;
          const s = logSeconds(log);
          if (s) seconds += s;
        }
      });
      return {
        week: week.week,
        /* The band key. Categorical, so it has to be a string. */
        name: String(week.week),
        planned: Math.round(planned * 10) / 10,
        logged: Math.round(logged * 10) / 10,
        pace: paceSecondsPerMile(seconds, logged),
      };
    });
  return (
    <section className="mt-4 rounded-sm border-3 border-outline bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-overline text-ink-soft">Weekly running miles</h2>
        <div className="flex items-center gap-3 text-meta text-ink-soft">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 border-2 border-outline bg-lilac" />
            planned
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 border-2 border-outline bg-primary" />
            run
          </span>
        </div>
      </div>

      {/*
       * The bars are pointer-driven, so the per-column buttons that used to
       * carry this to a screen reader are gone. The same numbers stay
       * reachable as text.
       */}
      <p className="sr-only">
        {weeks
          .map(
            (w) =>
              `Week ${w.week}: ${w.logged} miles run of ${Math.round(
                w.planned
              )} planned${w.pace ? `, averaging ${formatPacePerMile(w.pace)}` : ""}.`
          )
          .join(" ")}
      </p>

      <div className="mt-3">
        <BarChart
          data={weeks}
          xDataKey="name"
          aspectRatio="5 / 2"
          barGap={0.25}
          margin={{ top: 16, right: 8, bottom: 28, left: 8 }}
        >
          <Grid horizontal strokeDasharray="3,4" />
          {/* Square ends, to sit with the hard edges everything else wears. */}
          <Bar
            dataKey="planned"
            fill="var(--chart-5)"
            lineCap="butt"
            groupGap={2}
          />
          <Bar
            dataKey="logged"
            fill="var(--chart-line-primary)"
            lineCap="butt"
            groupGap={2}
          />
          <BarXAxis maxLabels={program.weeks} />
          <ChartTooltip
            showDatePill={false}
            content={({ point }) => (
              <div className="px-3 py-2 text-left">
                <div className="font-bold text-chart-tooltip-foreground">
                  Week {String(point.name)}
                </div>
                <div className="tabular-nums text-chart-tooltip-muted">
                  {Number(point.logged)} mi run · ~{Math.round(Number(point.planned))}{" "}
                  planned
                </div>
                <div className="tabular-nums text-chart-tooltip-muted">
                  {point.pace
                    ? formatPacePerMile(Number(point.pace))
                    : "no pace logged"}
                </div>
              </div>
            )}
          />
        </BarChart>
      </div>

      {/* The old chart bolded the current week's tick; the axis labels are the
          library's now, so the marker moves down here instead. */}
      {nowWeek !== null && (
        <p className="mt-1 text-center text-meta text-ink-soft">
          You are in week {nowWeek} of {program.weeks}.
        </p>
      )}
    </section>
  );
}

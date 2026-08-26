"use client";

import { useState } from "react";
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
  const [active, setActive] = useState<number | null>(null);
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
        if (log?.completed && workoutTracksRunningMiles(day)) {
          const miles =
            log.miles ?? (day.type === "run-or-cross" ? 0 : plannedMiles);
          logged += miles;
          const s = logSeconds(log);
          if (s && miles > 0) seconds += s;
        }
      });
      return {
        week: week.week,
        planned,
        logged,
        pace: paceSecondsPerMile(seconds, logged),
      };
    });
  const max = Math.max(...weeks.map((w) => Math.max(w.planned, w.logged)), 1);

  return (
    <section className="mt-4 rounded-sm border-3 border-outline bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-overline text-ink-soft">
          Weekly running miles
        </h2>
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
      <div className="mt-3 flex items-end gap-1.5">
        {weeks.map((w) => (
          <div
            key={w.week}
            className="relative flex flex-1 flex-col items-center gap-1"
            onMouseEnter={() => setActive(w.week)}
            onMouseLeave={() => setActive((a) => (a === w.week ? null : a))}
          >
            {/* The column is the hit target, so the numbers are reachable
                without having to land on a bar a few pixels wide. */}
            <button
              type="button"
              className="absolute inset-0 z-10 cursor-default"
              aria-label={`Week ${w.week}: ${
                Math.round(w.logged * 10) / 10
              } miles run of ~${Math.round(w.planned)} planned${
                w.pace ? `, averaging ${formatPacePerMile(w.pace)}` : ""
              }`}
              onFocus={() => setActive(w.week)}
              onBlur={() => setActive((a) => (a === w.week ? null : a))}
            />
            <div className="relative flex h-24 w-full items-end justify-center">
              <div
                className="w-full border-2 border-outline bg-lilac"
                style={{ height: `${(w.planned / max) * 100}%` }}
              />
              {w.logged > 0 && (
                <div
                  className="absolute inset-x-[18%] bottom-0 border-2 border-outline bg-primary"
                  style={{ height: `${(w.logged / max) * 100}%` }}
                />
              )}
            </div>
            <span
              className={`text-meta ${
                w.week === nowWeek
                  ? "font-bold text-primary-dark"
                  : "text-ink-soft"
              }`}
            >
              {w.week}
            </span>

            {active === w.week && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-max -translate-x-1/2 rounded-sm border-2 border-outline bg-surface px-2 py-1 text-left text-meta shadow-card">
                <div className="font-bold text-ink">Week {w.week}</div>
                <div className="tabular-nums text-ink-soft">
                  {Math.round(w.logged * 10) / 10} mi run · ~
                  {Math.round(w.planned)} planned
                </div>
                <div className="tabular-nums text-ink-soft">
                  {w.pace ? formatPacePerMile(w.pace) : "no pace logged"}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

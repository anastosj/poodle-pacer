"use client";

import { Program, workoutTracksRunningMiles } from "@/lib/programs";
import { Plan, beginWeekOf, logKey } from "@/lib/store";

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
      week.days.forEach((day, i) => {
        const plannedMiles = workoutTracksRunningMiles(day)
          ? day.miles ?? 0
          : 0;
        planned += plannedMiles;
        const log = plan.logs[logKey(week.week, i)];
        if (log?.completed && workoutTracksRunningMiles(day)) {
          logged +=
            log.miles ?? (day.type === "run-or-cross" ? 0 : plannedMiles);
        }
      });
      return { week: week.week, planned, logged };
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
          <div key={w.week} className="flex flex-1 flex-col items-center gap-1">
            <div className="relative flex h-24 w-full items-end justify-center">
              <div
                className="w-full border-2 border-outline bg-lilac"
                style={{ height: `${(w.planned / max) * 100}%` }}
                title={`Week ${w.week}: ~${Math.round(w.planned)} mi planned`}
              />
              {w.logged > 0 && (
                <div
                  className="absolute inset-x-[18%] bottom-0 border-x-2 border-t-2 border-outline bg-primary"
                  style={{ height: `${(w.logged / max) * 100}%` }}
                  title={`Week ${w.week}: ${Math.round(w.logged * 10) / 10} mi run`}
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
          </div>
        ))}
      </div>
    </section>
  );
}

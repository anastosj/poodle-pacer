"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import PoodleProgressBar from "@/components/PoodleProgressBar";
import StatsBar from "@/components/StatsBar";
import WeekGrid from "@/components/WeekGrid";
import { useApp } from "@/components/AppContext";
import { DAY_NAMES, Workout } from "@/lib/programs";
import { logKey } from "@/lib/store";

const CHEERS = [
  "Paws on the pavement — you've got this! 🐩",
  "Every mile earns extra belly rubs.",
  "Fluffy on the outside, fierce on the inside.",
  "Trot, jog, zoom — repeat!",
  "13.1 miles? That's just 26.2 zoomies.",
  "Blue headband on. Game face on.",
];

interface NextWorkout {
  week: number;
  dayIndex: number;
  workout: Workout;
  date: Date | null;
}

function findNextWorkout(
  schedule: { week: number; days: Workout[] }[],
  logs: Record<string, { completed: boolean }>,
  startDate?: string
): NextWorkout | null {
  const start = startDate ? new Date(startDate + "T00:00:00") : null;
  let fromDay = 0;
  if (start) {
    const diffDays = Math.floor((Date.now() - start.getTime()) / 86400000);
    if (diffDays > 0) fromDay = diffDays;
  }
  for (const week of schedule) {
    for (let dayIndex = 0; dayIndex < week.days.length; dayIndex++) {
      const workout = week.days[dayIndex];
      if (workout.type === "rest") continue;
      const dayNumber = (week.week - 1) * 7 + dayIndex;
      if (dayNumber < fromDay) continue;
      if (logs[logKey(week.week, dayIndex)]?.completed) continue;
      return {
        week: week.week,
        dayIndex,
        workout,
        date: start ? new Date(start.getTime() + dayNumber * 86400000) : null,
      };
    }
  }
  return null;
}

export default function HomePage() {
  const { plan, program, updatePlan } = useApp();
  const [cheer] = useState(
    () => CHEERS[Math.floor(Math.random() * CHEERS.length)]
  );

  let completed = 0;
  let totalWorkouts = 0;
  for (const week of program.schedule) {
    week.days.forEach((day, i) => {
      if (day.type === "rest") return;
      totalWorkouts += 1;
      if (plan.logs[logKey(week.week, i)]?.completed) completed += 1;
    });
  }

  const next = useMemo(
    () => findNextWorkout(program.schedule, plan.logs, plan.startDate),
    [program.schedule, plan.logs, plan.startDate]
  );
  const nextKey = next ? logKey(next.week, next.dayIndex) : undefined;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {plan.name}
          </h1>
          <p className="text-sm text-foreground/60">
            {program.author}&apos;s {program.name}
            {!plan.startDate && (
              <>
                {" · "}
                <Link href="/goals" className="font-semibold text-headband-dark underline">
                  set your race date
                </Link>
              </>
            )}
          </p>
        </div>
        <p className="rounded-full bg-headband-light px-4 py-1 text-sm font-medium text-headband-dark">
          {cheer}
        </p>
      </div>

      {next && (
        <section className="mt-4 flex flex-wrap items-center gap-4 rounded-pouf bg-headband p-5 text-white pouf-shadow">
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-wide text-white/70">
              ⭐ Next workout
            </div>
            <div className="mt-1 text-xl font-extrabold">
              {next.workout.label}
            </div>
            <div className="text-sm text-white/80">
              Week {next.week} · {DAY_NAMES[next.dayIndex]}
              {next.date &&
                ` · ${next.date.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}`}
            </div>
          </div>
          <button
            onClick={() =>
              updatePlan((prev) => ({
                ...prev,
                logs: {
                  ...prev.logs,
                  [logKey(next.week, next.dayIndex)]: {
                    ...prev.logs[logKey(next.week, next.dayIndex)],
                    completed: true,
                  },
                },
              }))
            }
            className="rounded-full bg-white px-5 py-2 text-sm font-bold text-headband-dark transition hover:bg-headband-light"
          >
            Mark done ✓
          </button>
        </section>
      )}

      <PoodleProgressBar
        fraction={totalWorkouts > 0 ? completed / totalWorkouts : 0}
        label={`${completed} of ${totalWorkouts} workouts`}
      />

      <StatsBar plan={plan} program={program} />

      <WeekGrid
        plan={plan}
        program={program}
        updatePlan={updatePlan}
        nextKey={nextKey}
      />

      <footer className="mt-10 pb-6 text-center text-xs text-foreground/50">
        Made with 🦴 by your poodle coach · Program: {program.author}&apos;s{" "}
        {program.name}
      </footer>
    </div>
  );
}

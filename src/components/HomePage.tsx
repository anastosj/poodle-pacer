"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CalendarGrid from "@/components/CalendarGrid";
import InsightsPanel from "@/components/InsightsPanel";
import MileageChart from "@/components/MileageChart";
import OnboardingWizard from "@/components/OnboardingWizard";
import PoodleProgressBar from "@/components/PoodleProgressBar";
import StatsBar from "@/components/StatsBar";
import { useApp } from "@/components/AppContext";
import PoodleMascot from "@/components/PoodleMascot";
import { PawIcon, StarIcon } from "@/components/Icons";
import { celebrate, celebrationKind } from "@/lib/celebrate";
import { fromISO } from "@/lib/dates";
import { Workout } from "@/lib/programs";
import {
  beginWeekOf,
  daysUntilStart,
  effectiveStartDate,
  logKey,
} from "@/lib/store";

const CHEERS = [
  "Paws on the pavement. You have got this.",
  "Every mile earns extra belly rubs.",
  "Fluffy on the outside, fierce on the inside.",
  "Trot, jog, zoom, repeat!",
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
  const { state, loaded, plan, program, updatePlan } = useApp();
  // Start on a fixed cheer so server and client agree, then shuffle after mount.
  const [cheer, setCheer] = useState(CHEERS[0]);
  useEffect(() => {
    setCheer(CHEERS[Math.floor(Math.random() * CHEERS.length)]);
  }, []);

  let completed = 0;
  let totalWorkouts = 0;
  for (const week of program.schedule) {
    if (week.week < beginWeekOf(plan)) continue;
    week.days.forEach((day, i) => {
      if (day.type === "rest") return;
      totalWorkouts += 1;
      if (plan.logs[logKey(week.week, i)]?.completed) completed += 1;
    });
  }

  const countdown = daysUntilStart(plan);
  const effectiveStart = effectiveStartDate(plan);
  const startsOn = effectiveStart ? fromISO(effectiveStart) : null;

  const next = useMemo(
    () =>
      findNextWorkout(
        program.schedule.filter((w) => w.week >= beginWeekOf(plan)),
        plan.logs,
        plan.startDate
      ),
    [program.schedule, plan]
  );
  const nextKey = next ? logKey(next.week, next.dayIndex) : undefined;

  // Wait for the server copy, otherwise the wizard flashes over an existing plan.
  const showOnboarding =
    loaded &&
    !state.onboarded &&
    !plan.startDate &&
    Object.keys(plan.logs).length === 0;

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

      {countdown > 0 && (
        <section className="mt-4 flex flex-wrap items-center gap-4 rounded-pouf bg-headband p-5 text-white pouf-shadow">
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-wide text-white/70">
              Countdown
            </div>
            <div className="mt-1 text-2xl font-extrabold">
              {countdown} day{countdown === 1 ? "" : "s"} until training starts
            </div>
            <div className="text-sm text-white/80">
              {startsOn &&
                `Week 1 begins ${startsOn.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}. Rest up.`}
            </div>
          </div>
          <PoodleMascot size={72} className="wag" />
        </section>
      )}

      {countdown === 0 && next && (
        <section className="mt-4 flex flex-wrap items-center gap-4 rounded-pouf bg-headband p-5 text-white pouf-shadow">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/70">
              <StarIcon size={13} />
              Next workout
            </div>
            <div className="mt-1 text-xl font-extrabold">
              {next.workout.label}
            </div>
            <div className="text-sm text-white/80">
              {next.date ? (
                <>
                  {/* Numbered from this runner's first training day, matching
                      the calendar cells, not from program week 1. */}
                  Day{" "}
                  {(next.week - beginWeekOf(plan)) * 7 + next.dayIndex + 1} ·{" "}
                  {next.date.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · Week {next.week}
                </>
              ) : (
                <>Week {next.week}</>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              celebrate(celebrationKind(next.workout));
              updatePlan((prev) => ({
                ...prev,
                logs: {
                  ...prev.logs,
                  [logKey(next.week, next.dayIndex)]: {
                    ...prev.logs[logKey(next.week, next.dayIndex)],
                    completed: true,
                  },
                },
              }));
            }}
            className="rounded-full bg-white px-5 py-2 text-sm font-bold text-headband-dark transition hover:bg-headband-light"
          >
            Mark done
          </button>
        </section>
      )}

      <PoodleProgressBar
        fraction={totalWorkouts > 0 ? completed / totalWorkouts : 0}
        label={`${completed} of ${totalWorkouts} workouts`}
      />

      <StatsBar plan={plan} program={program} />

      <InsightsPanel plan={plan} program={program} />

      <MileageChart plan={plan} program={program} />

      <CalendarGrid
        plan={plan}
        program={program}
        updatePlan={updatePlan}
        nextKey={nextKey}
      />

      <footer className="mt-10 flex flex-wrap items-center justify-center gap-1.5 pb-6 text-center text-xs text-foreground/50">
        <PawIcon size={13} className="opacity-50" />
        Made by your poodle coach · Program: {program.author}&apos;s{" "}
        {program.name}
      </footer>

      {showOnboarding && <OnboardingWizard />}
    </div>
  );
}

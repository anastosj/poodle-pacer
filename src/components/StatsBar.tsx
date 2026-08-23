"use client";

import { fromISO, startOfToday } from "@/lib/dates";
import { Program } from "@/lib/programs";
import {
  Plan,
  beginWeekOf,
  daysUntilStart,
  effectiveStartDate,
  logKey,
} from "@/lib/store";

/** Program week covering today, or null before training starts / after the race. */
function currentWeek(plan: Plan, program: Program): number | null {
  if (!plan.startDate) return null;
  const diffDays = Math.floor(
    (Date.now() - fromISO(plan.startDate).getTime()) / 86400000
  );
  if (diffDays < 0) return null;
  const week = Math.floor(diffDays / 7) + 1;
  if (week < beginWeekOf(plan) || week > program.weeks) return null;
  return week;
}

export default function StatsBar({
  plan,
  program,
}: {
  plan: Plan;
  program: Program;
}) {
  const begin = beginWeekOf(plan);

  let completed = 0;
  let totalWorkouts = 0;
  let milesRun = 0;
  let plannedMiles = 0;
  let streak = 0;
  let running = 0;

  for (const week of program.schedule) {
    if (week.week < begin) continue;
    week.days.forEach((day, i) => {
      if (day.type === "rest") return;
      totalWorkouts += 1;
      if (day.type === "run") plannedMiles += day.miles ?? 0;
      const log = plan.logs[logKey(week.week, i)];
      if (log?.completed) {
        completed += 1;
        milesRun += log.miles ?? (day.type === "run" ? day.miles ?? 0 : 0);
        running += 1;
        streak = running;
      } else {
        running = 0;
      }
    });
  }

  const week = currentWeek(plan, program);
  const countdown = daysUntilStart(plan);
  const raceDay = plan.startDate
    ? new Date(
        fromISO(plan.startDate).getTime() + (program.weeks * 7 - 1) * 86400000
      )
    : null;
  const daysToRace = raceDay
    ? Math.max(
        0,
        Math.ceil((raceDay.getTime() - startOfToday().getTime()) / 86400000)
      )
    : null;

  const weeksTraining = program.weeks - begin + 1;

  const stats: { label: string; value: string }[] = [
    {
      label: "Workouts done",
      value: `${completed} / ${totalWorkouts}`,
    },
    {
      label: "Miles logged",
      value: `${Math.round(milesRun * 10) / 10} / ~${Math.round(plannedMiles)}`,
    },
    {
      label: "Current week",
      value: week
        ? `Week ${week} of ${program.weeks}`
        : countdown > 0
          ? `Starts in ${countdown}d`
          : effectiveStartDate(plan)
            ? "Program complete"
            : "Set a race date",
    },
    {
      label: "Days to race",
      value: daysToRace !== null ? `${daysToRace}` : "not set",
    },
    {
      label: begin > 1 ? "Weeks you train" : "Workout streak",
      value:
        begin > 1
          ? `${weeksTraining} of ${program.weeks}`
          : streak > 0
            ? `${streak}`
            : "none yet",
    },
  ];

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-pouf bg-poodle-white p-4 text-center ring-1 ring-poodle-fur pouf-shadow"
        >
          <div className="text-lg font-extrabold text-headband-dark">
            {s.value}
          </div>
          <div className="text-xs font-medium text-foreground/60">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

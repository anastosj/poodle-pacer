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
import StatTile from "@/components/ui/StatTile";

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

  let streak = 0;
  let running = 0;

  for (const week of program.schedule) {
    if (week.week < begin) continue;
    week.days.forEach((day, i) => {
      if (day.type === "rest") return;
      const log = plan.logs[logKey(week.week, i)];
      if (log?.completed) {
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

  // Home shows only the three orienting numbers. Totals and mileage live on
  // the Progress page, so nothing is stated twice across the two screens.
  const stats: { label: string; value: string }[] = [
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
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {stats.map((s, index) => (
        <StatTile
          key={s.label}
          value={s.value}
          label={s.label}
          tone={index === 1 ? "cyan" : index === 2 ? "lilac" : "default"}
          className={`text-center ${index === 0 ? "col-span-2 sm:col-span-1" : ""}`}
        />
      ))}
    </div>
  );
}

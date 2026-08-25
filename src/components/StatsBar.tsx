"use client";

import { countsAsRunning } from "@/lib/activities";
import { fromISO, startOfToday } from "@/lib/dates";
import { Program } from "@/lib/programs";
import {
  Plan,
  SyncedRun,
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
  runs = [],
}: {
  plan: Plan;
  program: Program;
  runs?: SyncedRun[];
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

  // The log holds every sport, so only call them runs when they all are.
  const allRunning = runs.every((r) => countsAsRunning(r.sportType));

  const logged =
    begin > 1
      ? { label: "Weeks you train", value: `${weeksTraining} of ${program.weeks}` }
      : streak > 0
        ? { label: "Workout streak", value: `${streak}` }
        : runs.length > 0
          ? {
              label: allRunning ? "Runs logged" : "Activities logged",
              value: `${runs.length}`,
            }
          : { label: "Workout streak", value: "none yet" };

  // Home shows only the three orienting numbers. Totals and mileage live on
  // the Progress page, so nothing is stated twice across the two screens.
  //
  // Without a race date there is no current week and no countdown, so those two
  // tiles could only say "not set". An empty number is worse than no tile, so
  // they are dropped until there is a plan to measure against.
  const stats: { label: string; value: string }[] = plan.startDate
    ? [
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
        logged,
      ]
    : [logged];

  // Nothing planned and nothing logged: the page's own call to action says it
  // all, so an empty stat bar would just be furniture.
  if (stats.length === 1 && runs.length === 0 && streak === 0) return null;

  const single = stats.length === 1;

  return (
    <div
      className={`mt-4 grid gap-3 ${
        single ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"
      }`}
    >
      {stats.map((s, index) => (
        <StatTile
          key={s.label}
          value={s.value}
          label={s.label}
          tone={
            single ? "lilac" : index === 1 ? "cyan" : index === 2 ? "lilac" : "default"
          }
          className={`text-center ${
            !single && index === 0 ? "col-span-2 sm:col-span-1" : ""
          }`}
        />
      ))}
    </div>
  );
}

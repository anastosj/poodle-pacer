"use client";

import { Program, totalPlannedMiles } from "@/lib/programs";
import { Plan, logKey } from "@/lib/store";

function currentWeek(plan: Plan, program: Program): number | null {
  if (!plan.startDate) return null;
  const start = new Date(plan.startDate + "T00:00:00");
  const diffDays = Math.floor((Date.now() - start.getTime()) / 86400000);
  if (diffDays < 0) return null;
  const week = Math.floor(diffDays / 7) + 1;
  return week <= program.weeks ? week : null;
}

export default function StatsBar({
  plan,
  program,
}: {
  plan: Plan;
  program: Program;
}) {
  let completed = 0;
  let totalWorkouts = 0;
  let milesRun = 0;
  for (const week of program.schedule) {
    week.days.forEach((day, i) => {
      if (day.type === "rest") return;
      totalWorkouts += 1;
      const log = plan.logs[logKey(week.week, i)];
      if (log?.completed) {
        completed += 1;
        milesRun += log.miles ?? (day.type === "run" ? day.miles ?? 0 : 0);
      }
    });
  }
  const plannedMiles = totalPlannedMiles(program);
  const week = currentWeek(plan, program);
  const raceDay = plan.startDate
    ? new Date(
        new Date(plan.startDate + "T00:00:00").getTime() +
          (program.weeks * 7 - 1) * 86400000
      )
    : null;
  const daysToRace = raceDay
    ? Math.max(0, Math.ceil((raceDay.getTime() - Date.now()) / 86400000))
    : null;

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
      value: week ? `Week ${week} of ${program.weeks}` : "Set a start date!",
    },
    {
      label: "Days to race",
      value: daysToRace !== null ? `${daysToRace} 🏁` : "—",
    },
  ];

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
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

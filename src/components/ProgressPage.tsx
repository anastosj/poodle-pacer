"use client";

import Link from "next/link";
import AchievementsPanel from "@/components/AchievementsPanel";
import InsightsPanel from "@/components/InsightsPanel";
import RacePredictorCard from "@/components/RacePredictorCard";
import MileageChart from "@/components/MileageChart";
import PoodleProgressBar from "@/components/PoodleProgressBar";
import { useApp } from "@/components/AppContext";
import { beginWeekOf, logKey } from "@/lib/store";

export default function ProgressPage() {
  const { state, plan, program } = useApp();

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="type-display">Progress</h1>
      <p className="mt-1 type-body text-ink-muted">
        {plan.startDate
          ? `How ${plan.name} is going so far.`
          : "Set a race date to start tracking your training."}
      </p>

      <PoodleProgressBar
        fraction={totalWorkouts > 0 ? completed / totalWorkouts : 0}
        label={`${completed} of ${totalWorkouts} workouts`}
      />

      {program.raceDistanceMiles && (
        <RacePredictorCard plan={plan} program={program} />
      )}

      <InsightsPanel plan={plan} program={program} runs={state.runs ?? []} />

      <AchievementsPanel state={state} />

      <MileageChart plan={plan} program={program} />

      <p className="mt-6 text-center text-meta text-ink-soft">
        <Link href="/" className="font-bold text-primary underline">
          Back to this week
        </Link>
      </p>
    </div>
  );
}

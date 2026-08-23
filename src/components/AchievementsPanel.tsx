"use client";

import { useMemo } from "react";
import { FlameIcon, MedalIcon } from "@/components/Icons";
import { computeAchievements } from "@/lib/achievements";
import { RunnerState } from "@/lib/store";

export default function AchievementsPanel({ state }: { state: RunnerState }) {
  const achievements = useMemo(() => computeAchievements(state), [state]);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <section className="mt-4 rounded-pouf bg-poodle-white p-5 ring-1 ring-poodle-fur pouf-shadow">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground/60">
          Achievements
        </h2>
        <span className="text-[11px] font-bold text-foreground/45">
          {unlockedCount} of {achievements.length}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {achievements.map((a) => (
          <div
            key={a.id}
            className={`rounded-pouf p-3 text-center ring-1 transition ${
              a.unlocked
                ? "bg-poodle-cream ring-poodle-fur pouf-shadow"
                : "bg-poodle-white ring-poodle-fur/60 opacity-55 grayscale"
            }`}
          >
            {a.kind === "speed" ? (
              <MedalIcon size={26} />
            ) : (
              <FlameIcon size={26} />
            )}
            <div className="mt-1 text-xs font-bold">{a.title}</div>
            <div
              className={`mt-0.5 text-[11px] font-medium tabular-nums ${
                a.unlocked ? "text-headband-dark" : "text-foreground/50"
              }`}
            >
              {a.detail}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-foreground/45">
        Speed badges use a run&apos;s average pace over the badge distance.
        Streaks count plan days without a missed workout, rest days included.
      </p>
    </section>
  );
}

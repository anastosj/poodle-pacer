"use client";

import { useMemo } from "react";
import { BoneIcon, FlameIcon, MedalIcon } from "@/components/Icons";
import { computeAchievements } from "@/lib/achievements";
import { RunnerState } from "@/lib/store";

export default function AchievementsPanel({ state }: { state: RunnerState }) {
  const achievements = useMemo(() => computeAchievements(state), [state]);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <section className="mt-4 rounded-sm border-3 border-outline bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="type-overline text-ink-soft">
          Achievements
        </h2>
        <span className="text-meta font-bold text-ink-soft">
          {unlockedCount} of {achievements.length}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {achievements.map((a) => (
          <div
            key={a.id}
            className={`rounded-sm border-2 border-outline p-3 text-center transition ${
              a.unlocked
                ? "bg-lilac shadow-soft"
                : "bg-surface opacity-55 grayscale"
            }`}
          >
            <span className="relative inline-flex">
              {a.kind === "speed" ? (
                <MedalIcon size={30} />
              ) : (
                <FlameIcon size={30} />
              )}
              {a.unlocked && (
                <span className="absolute -right-3 -top-2 rotate-12">
                  <BoneIcon size={15} />
                </span>
              )}
            </span>
            <div className="mt-1 text-meta font-bold uppercase">{a.title}</div>
            <div
              className={`mt-0.5 text-meta font-medium tabular-nums ${
                a.unlocked ? "text-primary" : "text-ink-soft"
              }`}
            >
              {a.detail}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-meta text-ink-soft">
        Speed badges use a run&apos;s average pace over the badge distance.
        Streaks count plan days without a missed workout, rest days included.
      </p>
    </section>
  );
}

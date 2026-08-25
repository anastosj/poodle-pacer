"use client";

import { useMemo, useState } from "react";
import { BoneIcon, FlameIcon, MedalIcon } from "@/components/Icons";
import WorkoutDetail from "@/components/WorkoutDetail";
import { Achievement, EarnedBy, computeAchievements } from "@/lib/achievements";
import { fromISO } from "@/lib/dates";
import { RunLog, RunnerState } from "@/lib/store";

function shortDate(iso: string): string {
  return fromISO(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function longDate(iso: string): string {
  return fromISO(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function AchievementsPanel({ state }: { state: RunnerState }) {
  const achievements = useMemo(() => computeAchievements(state), [state]);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const [open, setOpen] = useState<EarnedBy | null>(null);

  /** The run behind a badge, when it is still there to open. */
  // A badge earned by a synced activity has no plan slot, so there is nothing
  // to open: it stays dated but inert, like one whose run was later deleted.
  const logFor = (earned: EarnedBy | undefined): RunLog | undefined =>
    earned?.planId && earned.logKey
      ? state.plans.find((p) => p.id === earned.planId)?.logs[earned.logKey]
      : undefined;

  const openLog = logFor(open ?? undefined);

  const badgeBody = (a: Achievement) => (
    <>
      <span className="relative inline-flex">
        {a.kind === "speed" ? <MedalIcon size={30} /> : <FlameIcon size={30} />}
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
      {a.unlocked && (a.earnedBy || a.span) && (
        <div className="mt-0.5 text-meta text-ink-soft">
          {a.span
            ? `${shortDate(a.span.fromIso)} – ${shortDate(a.span.toIso)}`
            : shortDate(a.earnedBy!.iso)}
        </div>
      )}
    </>
  );

  return (
    <section className="mt-4 rounded-sm border-3 border-outline bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="type-overline text-ink-soft">Achievements</h2>
        <span className="text-meta font-bold text-ink-soft">
          {unlockedCount} of {achievements.length}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {achievements.map((a) => {
          const base = "rounded-sm border-2 border-outline p-3 text-center transition";
          const tone = a.unlocked
            ? "bg-lilac shadow-soft"
            : "bg-surface opacity-55 grayscale";
          // Only a badge whose run is still logged becomes a button; a locked
          // one, or one whose run has since been deleted, stays inert.
          return logFor(a.earnedBy) ? (
            <button
              key={a.id}
              onClick={() => setOpen(a.earnedBy ?? null)}
              aria-label={`${a.title}, ${a.detail}, ${longDate(
                a.earnedBy!.iso
              )}. Open the run.`}
              className={`focus-pouf ${base} ${tone} pouf-lift cursor-pointer`}
            >
              {badgeBody(a)}
            </button>
          ) : (
            <div key={a.id} className={`${base} ${tone}`}>
              {badgeBody(a)}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-meta text-ink-soft">
        Speed badges use a run&apos;s average pace over the badge distance.
        Streaks count plan days without a missed workout, rest days included.
      </p>

      {open && openLog && (
        <WorkoutDetail
          log={openLog}
          planId={open.planId}
          logKey={open.logKey}
          label={open.label}
          dateLabel={longDate(open.iso)}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}

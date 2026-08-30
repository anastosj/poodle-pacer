"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import PoodleSleeping from "@/components/PoodleSleeping";
import { useApp } from "@/components/AppContext";
import { Gap, detectGap, rejoinWeekFor } from "@/lib/adapt";
import { formatShortDate } from "@/lib/calendar";
import { fromISO } from "@/lib/dates";
import {
  PAUSE_REASONS,
  PAUSE_REASON_LABEL,
  PauseReason,
  addPause,
} from "@/lib/store";

/**
 * Dismissals are per gap, so saying "no" quiets this stretch without quieting
 * the feature. Kept on the device rather than in synced state: it is a note
 * about a card, not about the training.
 */
const dismissKey = (planId: string, gap: Gap) =>
  `poodle-pacer:gap-dismissed:${planId}:${gap.toIso}`;

function isDismissed(planId: string, gap: Gap): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(dismissKey(planId, gap)) === "1";
  } catch {
    return false;
  }
}

function dismiss(planId: string, gap: Gap) {
  try {
    window.localStorage.setItem(dismissKey(planId, gap), "1");
  } catch {
    /* private browsing: the card simply returns next load */
  }
}

/**
 * Noticed time away, and the offer to stand the plan down for it.
 *
 * Deliberately not phrased as a warning. The runner already knows they missed
 * the week; what they need is somewhere for it to go that is not a column of
 * red. Race day never moves — the plan stays anchored — so the only thing the
 * pause changes is what those days are allowed to say about them.
 */
export default function LifeHappenedCard() {
  const { state, plan, program, updatePlan } = useApp();
  const [reason, setReason] = useState<PauseReason>("life");
  const [hidden, setHidden] = useState(false);

  const gap = detectGap(plan, program, state.runs ?? []);
  if (!gap || hidden || isDismissed(plan.id, gap)) return null;

  const rejoinWeek = rejoinWeekFor(gap, plan, program);

  const accept = () => {
    updatePlan((prev) => {
      const next = addPause(prev, {
        fromIso: gap.fromIso,
        toIso: gap.toIso,
        reason,
      });
      // Nothing was ever logged, so those weeks are empty rather than earned:
      // moving the begin week up costs no history and restores a real taper.
      return rejoinWeek === undefined ? next : { ...next, beginWeek: rejoinWeek };
    });
    setHidden(true);
  };

  const decline = () => {
    dismiss(plan.id, gap);
    setHidden(true);
  };

  return (
    <section className="mt-5 rounded-sm border-3 border-outline bg-surface p-5 shadow-card">
      <div className="flex items-start gap-3">
        <PoodleSleeping size={52} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-title uppercase text-ink">
            Life happened?
          </h2>
          <p className="mt-1 type-body text-ink-muted">
            Nothing logged from{" "}
            <strong className="text-ink">
              {formatShortDate(fromISO(gap.fromIso))}
            </strong>{" "}
            to{" "}
            <strong className="text-ink">
              {formatShortDate(fromISO(gap.toIso))}
            </strong>{" "}
            — {gap.days} days, {gap.missed} workout
            {gap.missed === 1 ? "" : "s"}. Race day hasn&apos;t moved, but those
            days don&apos;t have to count against you.
          </p>

          <fieldset className="mt-4">
            <legend className="type-overline text-ink-soft">
              What were you up to?
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {PAUSE_REASONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={reason === value}
                  onClick={() => setReason(value)}
                  className={`focus-pouf rounded-full border-2 border-outline px-3 py-1 text-meta font-bold transition ${
                    reason === value
                      ? "bg-ink text-background"
                      : "bg-surface text-ink hover:bg-lilac"
                  }`}
                >
                  {PAUSE_REASON_LABEL[value]}
                </button>
              ))}
            </div>
          </fieldset>

          <p className="mt-3 text-meta text-ink-soft">
            Paused days sit out of your consistency and can&apos;t break your
            streak.
            {rejoinWeek !== undefined &&
              ` Since you hadn't started yet, you'll also pick the plan up at week ${rejoinWeek}.`}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={accept}>Pause those days</Button>
            <Button variant="ghost" onClick={decline}>
              No, I&apos;m good
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

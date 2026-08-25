"use client";

import { useMemo } from "react";
import { FinishFlagIcon } from "@/components/Icons";
import { formatDuration, formatPacePerMile } from "@/lib/pace";
import { predictRace } from "@/lib/predictor";
import { Program } from "@/lib/programs";
import { Plan } from "@/lib/store";
import { formatShortDate } from "@/lib/calendar";
import { fromISO } from "@/lib/dates";

export default function RacePredictorCard({
  plan,
  program,
}: {
  plan: Plan;
  program: Program;
}) {
  const prediction = useMemo(() => predictRace(plan, program), [plan, program]);

  return (
    <section className="mt-4 rounded-sm border-3 border-outline bg-surface p-5 shadow-card">
      <h2 className="type-overline flex items-center gap-1.5 text-ink-soft">
        <FinishFlagIcon size={16} /> Race outlook
      </h2>
      {prediction ? (
        <>
          {/* The predicted time is a wide display number, so it sits on its own
              line and the two smaller stats share an even row beneath. Left to a
              flex-wrap the three broke 2-then-1 on a phone, stranding "Days to
              go" on a ragged second line. */}
          <div className="mt-3">
            <div className="font-display text-display tabular-nums text-primary">
              {formatDuration(prediction.seconds)}
            </div>
            <div className="text-[11px] font-medium text-foreground/60">
              Predicted {program.raceLabel.toLowerCase()}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-sm border-2 border-outline bg-lilac px-3 py-2">
              <div className="font-display text-title tabular-nums text-primary-dark">
                {formatPacePerMile(prediction.pace)}
              </div>
              <div className="text-[11px] font-medium text-ink-soft">
                Race pace
              </div>
            </div>
            {prediction.daysToRace !== undefined && (
              <div className="rounded-sm border-2 border-outline bg-lilac px-3 py-2">
                <div className="font-display text-title tabular-nums text-primary-dark">
                  {prediction.daysToRace}
                </div>
                <div className="text-[11px] font-medium text-ink-soft">
                  Days to go
                </div>
              </div>
            )}
          </div>
          <p className="mt-3 text-meta text-ink-soft">
            An estimate (Riegel formula) from your best recent run:{" "}
            {prediction.basis.miles} mi in{" "}
            {formatDuration(prediction.basis.seconds)} on{" "}
            {formatShortDate(fromISO(prediction.basis.iso))}. It sharpens as you
            log longer runs.
          </p>
        </>
      ) : (
        <p className="mt-2 type-body text-ink-muted">
          Log a timed run of 3+ miles and the poodle will predict your race
          finish time.
        </p>
      )}
    </section>
  );
}

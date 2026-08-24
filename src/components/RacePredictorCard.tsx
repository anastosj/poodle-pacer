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
          <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div>
              <div className="font-display text-display tabular-nums text-primary">
                {formatDuration(prediction.seconds)}
              </div>
              <div className="text-[11px] font-medium text-foreground/60">
                Predicted {program.raceLabel.toLowerCase()}
              </div>
            </div>
            <div>
              <div className="font-display text-title tabular-nums text-primary">
                {formatPacePerMile(prediction.pace)}
              </div>
              <div className="text-[11px] font-medium text-foreground/60">
                Race pace
              </div>
            </div>
            {prediction.daysToRace !== undefined && (
              <div>
                <div className="font-display text-title tabular-nums text-primary">
                  {prediction.daysToRace}
                </div>
                <div className="text-[11px] font-medium text-foreground/60">
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

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
    <section className="mt-4 rounded-pouf bg-poodle-white p-5 ring-1 ring-poodle-fur pouf-shadow">
      <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-foreground/60">
        <FinishFlagIcon size={16} /> Race outlook
      </h2>
      {prediction ? (
        <>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div>
              <div className="text-3xl font-extrabold tabular-nums text-headband-dark">
                {formatDuration(prediction.seconds)}
              </div>
              <div className="text-[11px] font-medium text-foreground/60">
                Predicted half marathon
              </div>
            </div>
            <div>
              <div className="text-xl font-extrabold tabular-nums text-headband-dark">
                {formatPacePerMile(prediction.pace)}
              </div>
              <div className="text-[11px] font-medium text-foreground/60">
                Race pace
              </div>
            </div>
            {prediction.daysToRace !== undefined && (
              <div>
                <div className="text-xl font-extrabold tabular-nums text-headband-dark">
                  {prediction.daysToRace}
                </div>
                <div className="text-[11px] font-medium text-foreground/60">
                  Days to go
                </div>
              </div>
            )}
          </div>
          <p className="mt-3 text-[11px] text-foreground/50">
            An estimate (Riegel formula) from your best recent run:{" "}
            {prediction.basis.miles} mi in{" "}
            {formatDuration(prediction.basis.seconds)} on{" "}
            {formatShortDate(fromISO(prediction.basis.iso))}. It sharpens as
            your long runs get longer.
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-foreground/60">
          Log a timed run of 3+ miles and the poodle will predict your race
          finish time.
        </p>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import PoodleMascot from "@/components/PoodleMascot";
import { useApp } from "@/components/AppContext";
import { programs } from "@/lib/programs";
import { planFromRaceDate, updateActivePlan } from "@/lib/store";

type DateMode = "race" | "start";

export default function OnboardingWizard() {
  const { update, plan } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [programId, setProgramId] = useState(plan.programId);
  const [dateMode, setDateMode] = useState<DateMode>("race");
  const [date, setDate] = useState("");

  const chosenProgram =
    programs.find((p) => p.id === programId) ?? programs[0];

  const skip = () => update((prev) => ({ ...prev, onboarded: true }));

  const finish = () => {
    update((prev) => ({
      ...updateActivePlan(prev, (p) => {
        if (!date) return { ...p, name: name.trim() || p.name, programId };
        // A race date may fall inside the program window, in which case the
        // runner joins partway in instead of starting weeks behind.
        const schedule =
          dateMode === "race"
            ? planFromRaceDate(date, chosenProgram.weeks)
            : { startDate: date, beginWeek: 1 };
        return {
          ...p,
          name: name.trim() || p.name,
          programId,
          startDate: schedule.startDate,
          beginWeek: schedule.beginWeek > 1 ? schedule.beginWeek : undefined,
        };
      }),
      onboarded: true,
    }));
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-sm border-3 border-outline bg-surface p-6 shadow-hero">
        <div className="flex items-center gap-3">
          <PoodleMascot size={56} />
          <div>
            <h2 className="type-title">
              {step === 0 && "Welcome to Poodle Pacer"}
              {step === 1 && "Pick your program"}
              {step === 2 && "When's the big day?"}
            </h2>
            <p className="text-meta text-ink-soft">Step {step + 1} of 3</p>
          </div>
        </div>

        {step === 0 && (
          <div className="mt-4">
            <p className="type-body text-ink-muted">
              Let&apos;s set up your race in three quick steps. First, what
              are you training for?
            </p>
            <input
              type="text"
              autoFocus
              placeholder="e.g. Brooklyn Half 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="focus-pouf mt-3 w-full rounded-sm border-2 border-outline bg-surface px-3 py-2.5 text-sm font-semibold"
            />
          </div>
        )}

        {step === 1 && (
          <div className="mt-4">
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="focus-pouf w-full rounded-sm border-2 border-outline bg-surface px-3 py-2.5 text-sm font-medium"
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.available}>
                  {p.author}: {p.name} ({p.weeks} weeks)
                  {p.available ? "" : " (coming soon)"}
                </option>
              ))}
            </select>
            <p className="mt-2 text-meta text-ink-soft">
              {chosenProgram.description}
            </p>
            <a
              href={chosenProgram.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs font-semibold text-headband-dark underline"
            >
              {chosenProgram.sourceLabel}
            </a>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4">
            <div className="flex gap-2">
              <button
                onClick={() => setDateMode("race")}
                className={`focus-pouf flex-1 rounded-sm border-2 border-outline px-3 py-2 text-sm font-bold transition ${
                  dateMode === "race"
                    ? "bg-primary text-white"
                    : "bg-lilac text-ink-muted"
                }`}
              >
                I know my race day
              </button>
              <button
                onClick={() => setDateMode("start")}
                className={`focus-pouf flex-1 rounded-sm border-2 border-outline px-3 py-2 text-sm font-bold transition ${
                  dateMode === "start"
                    ? "bg-primary text-white"
                    : "bg-lilac text-ink-muted"
                }`}
              >
                Pick a start date
              </button>
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="focus-pouf mt-3 w-full rounded-sm border-2 border-outline bg-surface px-3 py-2.5 text-sm"
            />
            <p className="mt-2 text-meta text-ink-soft">
              {dateMode === "race"
                ? `Week 1 starts ${chosenProgram.weeks} weeks before race day.`
                : `Race day lands ${chosenProgram.weeks} weeks after Week 1 starts (a Sunday).`}
            </p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={skip}
            className="focus-pouf text-meta font-bold text-ink-soft hover:text-ink"
          >
            Skip for now
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="hard-button focus-pouf rounded-sm bg-surface px-4 py-2 text-sm font-bold text-ink-muted"
              >
                Back
              </button>
            )}
            {step < 2 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="hard-button focus-pouf rounded-sm bg-primary px-5 py-2 text-sm font-bold uppercase text-white"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={finish}
                className="hard-button focus-pouf rounded-sm bg-primary px-5 py-2 text-sm font-bold uppercase text-white"
              >
                Let&apos;s go
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

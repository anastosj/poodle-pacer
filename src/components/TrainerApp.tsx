"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PoodleMascot from "@/components/PoodleMascot";
import StravaCard from "@/components/StravaCard";
import StatsBar from "@/components/StatsBar";
import WeekGrid from "@/components/WeekGrid";
import { programs } from "@/lib/programs";
import {
  RUNNERS,
  RunnerId,
  RunnerState,
  loadState,
  saveState,
} from "@/lib/store";

const CHEERS = [
  "Paws on the pavement — you've got this! 🐩",
  "Every mile earns extra belly rubs.",
  "Fluffy on the outside, fierce on the inside.",
  "Trot, jog, zoom — repeat!",
  "13.1 miles? That's just 26.2 zoomies.",
  "Blue headband on. Game face on.",
];

export default function TrainerApp() {
  const [runner, setRunner] = useState<RunnerId>("jonathan");
  const [state, setState] = useState<RunnerState | null>(null);
  const [cheer, setCheer] = useState(CHEERS[0]);

  useEffect(() => {
    setState(loadState(runner));
  }, [runner]);

  useEffect(() => {
    setCheer(CHEERS[Math.floor(Math.random() * CHEERS.length)]);
  }, [runner]);

  const update = useCallback(
    (updater: (prev: RunnerState) => RunnerState) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        saveState(runner, next);
        return next;
      });
    },
    [runner]
  );

  const program = useMemo(
    () => programs.find((p) => p.id === state?.programId) ?? programs[0],
    [state?.programId]
  );

  if (!state) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <PoodleMascot size={110} />
        <h1 className="text-3xl font-extrabold tracking-tight">
          Poodle Pacer
        </h1>
        <p className="text-sm text-foreground/70">
          Your fluffy half marathon training sidekick
        </p>
        <p className="rounded-full bg-headband-light px-4 py-1 text-sm font-medium text-headband-dark">
          {cheer}
        </p>
      </header>

      <div className="mt-6 flex justify-center gap-2">
        {RUNNERS.map((r) => (
          <button
            key={r.id}
            onClick={() => setRunner(r.id)}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              runner === r.id
                ? "bg-headband text-white pouf-shadow"
                : "bg-poodle-white text-foreground/70 ring-1 ring-poodle-fur hover:bg-poodle-cream"
            }`}
          >
            {r.emoji} {r.name}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-pouf bg-poodle-white p-5 ring-1 ring-poodle-fur pouf-shadow">
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground/60">
            Training Program
          </h2>
          <select
            value={state.programId}
            onChange={(e) =>
              update((prev) => ({ ...prev, programId: e.target.value }))
            }
            className="mt-2 w-full rounded-xl border border-poodle-fur bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-headband"
          >
            {programs.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.available}>
                {p.author} — {p.name} ({p.weeks} weeks)
                {p.available ? "" : " — coming soon"}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-foreground/60">{program.description}</p>
          <label className="mt-3 block text-sm font-medium">
            Week 1 starts on (a Monday):
            <input
              type="date"
              value={state.startDate ?? ""}
              onChange={(e) =>
                update((prev) => ({
                  ...prev,
                  startDate: e.target.value || undefined,
                }))
              }
              className="mt-1 w-full rounded-xl border border-poodle-fur bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-headband"
            />
          </label>
        </section>

        <StravaCard runner={runner} state={state} update={update} program={program} />
      </div>

      <StatsBar state={state} program={program} />

      <WeekGrid state={state} program={program} update={update} />

      <footer className="mt-10 pb-6 text-center text-xs text-foreground/50">
        Made with 🦴 by your poodle coach · Program: {program.author}&apos;s{" "}
        {program.name}
      </footer>
    </div>
  );
}

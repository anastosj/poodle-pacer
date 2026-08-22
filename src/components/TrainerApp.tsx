"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PoodleMascot from "@/components/PoodleMascot";
import PoodleProgressBar from "@/components/PoodleProgressBar";
import StravaCard from "@/components/StravaCard";
import StatsBar from "@/components/StatsBar";
import AlertsCard from "@/components/AlertsCard";
import WeekGrid from "@/components/WeekGrid";
import { programs } from "@/lib/programs";
import {
  Plan,
  RUNNERS,
  RunnerId,
  RunnerState,
  activePlan,
  loadState,
  makePlan,
  raceDateFromStart,
  saveState,
  startDateFromRace,
  updateActivePlan,
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

  const updatePlan = useCallback(
    (updater: (plan: Plan) => Plan) => {
      update((prev) => updateActivePlan(prev, updater));
    },
    [update]
  );

  const plan = useMemo(() => (state ? activePlan(state) : null), [state]);
  const program = useMemo(
    () => programs.find((p) => p.id === plan?.programId) ?? programs[0],
    [plan?.programId]
  );

  if (!state || !plan) return null;

  const raceDate = plan.startDate
    ? raceDateFromStart(plan.startDate, program.weeks)
    : "";

  let completed = 0;
  let totalWorkouts = 0;
  for (const week of program.schedule) {
    week.days.forEach((day, i) => {
      if (day.type === "rest") return;
      totalWorkouts += 1;
      if (plan.logs[`${week.week}-${i}`]?.completed) completed += 1;
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <PoodleMascot size={110} />
        <h1 className="text-3xl font-extrabold tracking-tight">Poodle Pacer</h1>
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

      {/* Race plans */}
      <section className="mt-6 rounded-pouf bg-poodle-white p-5 ring-1 ring-poodle-fur pouf-shadow">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground/60">
            🏁 Races
          </h2>
          <div className="flex flex-wrap gap-2">
            {state.plans.map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  update((prev) => ({ ...prev, activePlanId: p.id }))
                }
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  p.id === state.activePlanId
                    ? "bg-headband text-white"
                    : "bg-poodle-cream text-foreground/60 ring-1 ring-poodle-fur hover:bg-headband-light"
                }`}
              >
                {p.name}
              </button>
            ))}
            <button
              onClick={() => {
                const name = window.prompt("Name your race / training plan:");
                if (!name?.trim()) return;
                const newPlan = makePlan(name.trim());
                update((prev) => ({
                  ...prev,
                  plans: [...prev.plans, newPlan],
                  activePlanId: newPlan.id,
                }));
              }}
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-headband-dark ring-1 ring-dashed ring-headband hover:bg-headband-light"
            >
              + New race
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={plan.name}
            onChange={(e) =>
              updatePlan((p) => ({ ...p, name: e.target.value }))
            }
            aria-label="Race name"
            className="rounded-xl border border-poodle-fur bg-white px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-headband"
          />
          {state.plans.length > 1 && (
            <button
              onClick={() => {
                if (!window.confirm(`Delete "${plan.name}" and its logs?`)) return;
                update((prev) => {
                  const plans = prev.plans.filter(
                    (p) => p.id !== prev.activePlanId
                  );
                  return { ...prev, plans, activePlanId: plans[0].id };
                });
              }}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-red-500 ring-1 ring-red-200 hover:bg-red-50"
            >
              Delete race
            </button>
          )}
        </div>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-pouf bg-poodle-white p-5 ring-1 ring-poodle-fur pouf-shadow">
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground/60">
            Training Program
          </h2>
          <select
            value={plan.programId}
            onChange={(e) =>
              updatePlan((p) => ({ ...p, programId: e.target.value }))
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
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Week 1 starts (Monday):
              <input
                type="date"
                value={plan.startDate ?? ""}
                onChange={(e) =>
                  updatePlan((p) => ({
                    ...p,
                    startDate: e.target.value || undefined,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-poodle-fur bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-headband"
              />
            </label>
            <label className="block text-sm font-medium">
              …or race day (Sunday):
              <input
                type="date"
                value={raceDate}
                onChange={(e) =>
                  updatePlan((p) => ({
                    ...p,
                    startDate: e.target.value
                      ? startDateFromRace(e.target.value, program.weeks)
                      : undefined,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-poodle-fur bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-headband"
              />
            </label>
          </div>
          <p className="mt-1 text-[11px] text-foreground/50">
            Set either one — the other fills in automatically ({program.weeks}{" "}
            weeks apart).
          </p>
        </section>

        <StravaCard
          runner={runner}
          plan={plan}
          updatePlan={updatePlan}
          program={program}
        />
      </div>

      <PoodleProgressBar
        fraction={totalWorkouts > 0 ? completed / totalWorkouts : 0}
        label={`${completed} of ${totalWorkouts} workouts`}
      />

      <StatsBar plan={plan} program={program} />

      <AlertsCard state={state} update={update} plan={plan} program={program} />

      <WeekGrid plan={plan} program={program} updatePlan={updatePlan} />

      <footer className="mt-10 pb-6 text-center text-xs text-foreground/50">
        Made with 🦴 by your poodle coach · Program: {program.author}&apos;s{" "}
        {program.name}
      </footer>
    </div>
  );
}

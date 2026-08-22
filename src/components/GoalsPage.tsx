"use client";

import { programs } from "@/lib/programs";
import { useApp } from "@/components/AppContext";
import {
  makePlan,
  raceDateFromStart,
  startDateFromRace,
} from "@/lib/store";

export default function GoalsPage() {
  const { state, update, plan, updatePlan, program } = useApp();

  const raceDate = plan.startDate
    ? raceDateFromStart(plan.startDate, program.weeks)
    : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-extrabold tracking-tight">🎯 Goals</h1>
      <p className="mt-1 text-sm text-foreground/60">
        Pick your race, program, and dates — the poodle handles the rest.
      </p>

      <section className="mt-5 rounded-pouf bg-poodle-white p-5 ring-1 ring-poodle-fur pouf-shadow">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground/60">
          🏁 Races
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {state.plans.map((p) => (
            <button
              key={p.id}
              onClick={() => update((prev) => ({ ...prev, activePlanId: p.id }))}
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
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={plan.name}
            onChange={(e) => updatePlan((p) => ({ ...p, name: e.target.value }))}
            aria-label="Race name"
            className="rounded-xl border border-poodle-fur bg-white px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-headband"
          />
          {state.plans.length > 1 && (
            <button
              onClick={() => {
                if (!window.confirm(`Delete "${plan.name}" and its logs?`))
                  return;
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

      <section className="mt-4 rounded-pouf bg-poodle-white p-5 ring-1 ring-poodle-fur pouf-shadow">
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
    </div>
  );
}

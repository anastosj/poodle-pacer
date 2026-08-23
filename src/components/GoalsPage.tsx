"use client";

import { programs } from "@/lib/programs";
import { useApp } from "@/components/AppContext";
import {
  Plan,
  beginWeekOf,
  daysUntilStart,
  effectiveStartDate,
  makePlan,
  planFromRaceDate,
  raceDateFromStart,
} from "@/lib/store";

/** Plain-language read of what the chosen dates mean for this runner. */
function describeSchedule(
  plan: Plan,
  weeks: number
): { message: string; tone: "info" | "warn" } | null {
  if (!plan.startDate) return null;

  const begin = beginWeekOf(plan);
  const countdown = daysUntilStart(plan);

  if (begin > 1) {
    const remaining = weeks - begin + 1;
    return {
      tone: "warn",
      message: `Your race is sooner than the full ${weeks} week program, so you are joining at week ${begin} and training for the final ${remaining} week${
        remaining === 1 ? "" : "s"
      }. The schedule works backwards from race day, so you get the taper and the long runs that matter most.`,
    };
  }

  if (countdown > 0) {
    return {
      tone: "info",
      message: `All set. Training begins in ${countdown} day${
        countdown === 1 ? "" : "s"
      }, and you will run the full ${weeks} week program.`,
    };
  }

  return {
    tone: "info",
    message: `You are running the full ${weeks} week program.`,
  };
}

export default function GoalsPage() {
  const { state, update, plan, updatePlan, program } = useApp();

  const raceDate = plan.startDate
    ? raceDateFromStart(plan.startDate, program.weeks)
    : "";
  const schedule = describeSchedule(plan, program.weeks);

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
            Race day (Sunday):
            <input
              type="date"
              value={raceDate}
              onChange={(e) => {
                const value = e.target.value;
                updatePlan((p) => {
                  if (!value) {
                    return { ...p, startDate: undefined, beginWeek: undefined };
                  }
                  const next = planFromRaceDate(value, program.weeks);
                  return {
                    ...p,
                    startDate: next.startDate,
                    beginWeek: next.beginWeek,
                  };
                });
              }}
              className="mt-1 w-full rounded-xl border border-poodle-fur bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-headband"
            />
          </label>
          <label className="block text-sm font-medium">
            or training starts (Monday):
            <input
              type="date"
              value={effectiveStartDate(plan) ?? ""}
              onChange={(e) =>
                updatePlan((p) => ({
                  ...p,
                  // Setting the start directly means running the whole program.
                  startDate: e.target.value || undefined,
                  beginWeek: undefined,
                }))
              }
              className="mt-1 w-full rounded-xl border border-poodle-fur bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-headband"
            />
          </label>
        </div>

        {schedule && (
          <p
            className={`mt-3 rounded-xl px-4 py-2.5 text-xs leading-relaxed ${
              schedule.tone === "warn"
                ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                : "bg-headband-light text-headband-dark"
            }`}
          >
            {schedule.message}
          </p>
        )}
      </section>
    </div>
  );
}

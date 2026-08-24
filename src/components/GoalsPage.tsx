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
      }. The schedule works backwards from race day, so you get the taper and key workouts that matter most.`,
    };
  }

  if (countdown > 0) {
    return {
      tone: "info",
      message: `All set. Training begins in ${countdown} day${
        countdown === 1 ? "" : "s"
      }, and you will complete the full ${weeks} week program.`,
    };
  }

  return {
    tone: "info",
    message: `You are completing the full ${weeks} week program.`,
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
      <h1 className="type-display">Goals</h1>
      <p className="mt-1 type-body text-ink-muted">
        Pick your race, program, and dates. The poodle handles the rest.
      </p>

      <section className="mt-5 rounded-sm border-3 border-outline bg-surface p-5 shadow-card">
        <h2 className="type-overline text-ink-soft">
          Races
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {state.plans.map((p) => (
            <button
              key={p.id}
              onClick={() => update((prev) => ({ ...prev, activePlanId: p.id }))}
              className={`focus-pouf rounded-full border-2 border-outline px-4 py-1.5 text-sm font-bold transition ${
                p.id === state.activePlanId
                  ? "bg-ink text-background"
                  : "bg-lilac text-ink-muted hover:bg-highlight"
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
            className="focus-pouf rounded-full border-2 border-dashed border-primary px-4 py-1.5 text-sm font-bold text-primary hover:bg-lilac"
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
            className="focus-pouf rounded-sm border-2 border-outline bg-surface px-3 py-2 text-sm font-bold"
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
              className="focus-pouf rounded-full border-2 border-red-700 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
            >
              Delete race
            </button>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-sm border-3 border-outline bg-surface p-5 shadow-card">
        <h2 className="type-overline text-ink-soft">
          Training Program
        </h2>
        <select
          value={plan.programId}
          onChange={(e) => {
            const nextProgram = programs.find(
              (candidate) => candidate.id === e.target.value,
            );
            updatePlan((p) => {
              if (!nextProgram || !raceDate) {
                return { ...p, programId: e.target.value };
              }
              const next = planFromRaceDate(raceDate, nextProgram.weeks);
              return {
                ...p,
                programId: e.target.value,
                startDate: next.startDate,
                beginWeek: next.beginWeek,
              };
            });
          }}
          className="focus-pouf mt-2 w-full rounded-sm border-2 border-outline bg-surface px-3 py-2 text-sm font-medium"
        >
          {programs.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.available}>
              {p.author}: {p.name} ({p.weeks} weeks)
              {p.available ? "" : " (coming soon)"}
            </option>
          ))}
        </select>
        <p className="mt-2 text-meta text-ink-soft">{program.description}</p>
        <a
          href={program.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-meta font-bold text-primary underline"
        >
          {program.sourceLabel}
        </a>
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
              className="focus-pouf mt-1 w-full rounded-sm border-2 border-outline bg-surface px-3 py-2 text-sm"
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
                  // Setting the start directly means completing the whole program.
                  startDate: e.target.value || undefined,
                  beginWeek: undefined,
                }))
              }
              className="focus-pouf mt-1 w-full rounded-sm border-2 border-outline bg-surface px-3 py-2 text-sm"
            />
          </label>
        </div>

        {schedule && (
          <p
            className={`mt-3 rounded-sm border-2 border-outline px-4 py-2.5 text-meta leading-relaxed ${
              schedule.tone === "warn"
                ? "bg-lilac text-ink"
                : "bg-pale-cyan text-ink"
            }`}
          >
            {schedule.message}
          </p>
        )}
      </section>
    </div>
  );
}

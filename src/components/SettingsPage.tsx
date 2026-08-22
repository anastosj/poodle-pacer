"use client";

import AlertsCard from "@/components/AlertsCard";
import StravaCard from "@/components/StravaCard";
import { useApp } from "@/components/AppContext";
import { RUNNERS } from "@/lib/store";

export default function SettingsPage() {
  const { runner, setRunner, state, update, plan, updatePlan, program } =
    useApp();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-extrabold tracking-tight">⚙️ Settings</h1>
      <p className="mt-1 text-sm text-foreground/60">
        Profile, notifications, and connections.
      </p>

      <section className="mt-5 rounded-pouf bg-poodle-white p-5 ring-1 ring-poodle-fur pouf-shadow">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground/60">
          👤 Profile
        </h2>
        <p className="mt-2 text-xs text-foreground/60">
          Who&apos;s training? Each runner keeps their own races, logs, and
          alerts.
        </p>
        <div className="mt-3 flex gap-2">
          {RUNNERS.map((r) => (
            <button
              key={r.id}
              onClick={() => setRunner(r.id)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                runner === r.id
                  ? "bg-headband text-white pouf-shadow"
                  : "bg-white text-foreground/70 ring-1 ring-poodle-fur hover:bg-poodle-cream"
              }`}
            >
              {r.emoji} {r.name}
            </button>
          ))}
        </div>
      </section>

      <AlertsCard state={state} update={update} plan={plan} program={program} />

      <div className="mt-4">
        <StravaCard
          runner={runner}
          plan={plan}
          updatePlan={updatePlan}
          program={program}
        />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Program, Workout } from "@/lib/programs";
import { Plan, RunnerState } from "@/lib/store";

function todaysWorkout(plan: Plan, program: Program): Workout | null {
  if (!plan.startDate) return null;
  const start = new Date(plan.startDate + "T00:00:00");
  const diffDays = Math.floor((Date.now() - start.getTime()) / 86400000);
  if (diffDays < 0 || diffDays >= program.weeks * 7) return null;
  const week = Math.floor(diffDays / 7);
  return program.schedule[week]?.days[diffDays % 7] ?? null;
}

export default function AlertsCard({
  state,
  update,
  plan,
  program,
}: {
  state: RunnerState;
  update: (updater: (prev: RunnerState) => RunnerState) => void;
  plan: Plan;
  program: Program;
}) {
  const [testResult, setTestResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const { alerts } = state;
  const workout = todaysWorkout(plan, program);
  const preview = workout
    ? `🐩 Morning, runner! Today's plan: ${workout.label}. Headband on — let's go!`
    : plan.startDate
      ? `🐩 Morning, runner! Training hasn't started yet — rest up, big things ahead!`
      : `🐩 Morning, runner! Set a start date to get workout texts.`;

  const sendTest = async () => {
    setSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/alerts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: alerts.phone, message: preview }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult("Test text sent! 📱");
      } else if (data.error === "not_configured") {
        setTestResult(
          "SMS isn't configured yet — Twilio credentials are needed on the server."
        );
      } else {
        setTestResult("Couldn't send the text — check the phone number.");
      }
    } catch {
      setTestResult("Couldn't reach the server.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mt-4 rounded-pouf bg-poodle-white p-5 ring-1 ring-poodle-fur pouf-shadow">
      <h2 className="text-sm font-bold uppercase tracking-wide text-foreground/60">
        📱 Morning Workout Texts
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <input
          type="tel"
          placeholder="Phone number e.g. +1 555 123 4567"
          value={alerts.phone}
          onChange={(e) =>
            update((prev) => ({
              ...prev,
              alerts: { ...prev.alerts, phone: e.target.value },
            }))
          }
          className="rounded-xl border border-poodle-fur bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-headband"
        />
        <input
          type="time"
          value={alerts.time}
          onChange={(e) =>
            update((prev) => ({
              ...prev,
              alerts: { ...prev.alerts, time: e.target.value },
            }))
          }
          className="rounded-xl border border-poodle-fur bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-headband"
        />
        <button
          onClick={() =>
            update((prev) => ({
              ...prev,
              alerts: { ...prev.alerts, enabled: !prev.alerts.enabled },
            }))
          }
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            alerts.enabled
              ? "bg-headband text-white"
              : "bg-poodle-cream text-foreground/60 ring-1 ring-poodle-fur"
          }`}
        >
          {alerts.enabled ? "Alerts on 🔔" : "Alerts off 🔕"}
        </button>
      </div>
      <div className="mt-3 rounded-xl bg-poodle-cream p-3 text-xs text-foreground/70">
        <span className="font-semibold">Preview:</span> {preview}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={sendTest}
          disabled={sending || !alerts.phone}
          className="rounded-full bg-headband px-4 py-2 text-xs font-semibold text-white transition hover:bg-headband-dark disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send test text"}
        </button>
        {testResult && (
          <span className="text-xs font-medium text-headband-dark">
            {testResult}
          </span>
        )}
      </div>
    </section>
  );
}

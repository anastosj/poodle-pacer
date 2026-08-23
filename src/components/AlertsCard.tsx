"use client";

import { useCallback, useEffect, useState } from "react";
import { BellIcon, CheckIcon, PhoneIcon } from "@/components/Icons";
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

/** Digits only, so "+1 (555) 123-4567" and "+15551234567" compare equal. */
const normalize = (phone: string) => phone.replace(/\D/g, "");

/** Twilio wants E.164. Accept a bare 10-digit US number and add the country code. */
function toE164(phone: string): string | null {
  const digits = normalize(phone);
  if (phone.trim().startsWith("+") && digits.length >= 8) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

type SendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

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
  const [send, setSend] = useState<SendState>({ kind: "idle" });
  const [smsConfigured, setSmsConfigured] = useState<boolean | null>(null);
  const { alerts } = state;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setSmsConfigured(json?.sms?.configured ?? false))
      .catch(() => setSmsConfigured(false));
  }, []);

  // Alert times are wall-clock, so the server needs to know whose clock.
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  useEffect(() => {
    if (browserTz && alerts.timezone !== browserTz) {
      update((prev) => ({
        ...prev,
        alerts: { ...prev.alerts, timezone: browserTz },
      }));
    }
  }, [browserTz, alerts.timezone, update]);

  const workout = todaysWorkout(plan, program);
  const preview = workout
    ? `Morning! Today's plan: ${workout.label}. Headband on, let's go.`
    : plan.startDate
      ? `Morning! Training hasn't started yet. Rest up, big things ahead.`
      : `Morning! Set a race date to get workout texts.`;

  const e164 = toE164(alerts.phone);
  const confirmed =
    Boolean(alerts.confirmedPhone) &&
    normalize(alerts.confirmedPhone!) === normalize(alerts.phone) &&
    normalize(alerts.phone).length > 0;

  const sendConfirmation = useCallback(async () => {
    if (!e164) {
      setSend({
        kind: "error",
        message: "That does not look like a phone number. Try +1 555 123 4567.",
      });
      return;
    }
    setSend({ kind: "sending" });
    try {
      const res = await fetch("/api/alerts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: e164,
          message: `Poodle Pacer is connected. You'll get your workout here each morning. Sample: ${preview}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSend({ kind: "sent" });
        update((prev) => ({
          ...prev,
          alerts: { ...prev.alerts, confirmedPhone: prev.alerts.phone },
        }));
        return;
      }
      setSend({
        kind: "error",
        message:
          data.error === "not_configured"
            ? "Texting is not switched on for this app yet, so nothing was sent."
            : data.error === "send_failed"
              ? "Twilio rejected that number. Check it and try again."
              : "Could not send the text. Please try again.",
      });
    } catch {
      setSend({ kind: "error", message: "Could not reach the server." });
    }
  }, [e164, preview, update]);

  const setEnabled = (enabled: boolean) =>
    update((prev) => ({ ...prev, alerts: { ...prev.alerts, enabled } }));

  return (
    <section className="mt-4 rounded-pouf bg-poodle-white p-5 ring-1 ring-poodle-fur pouf-shadow">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-foreground/60">
        <PhoneIcon size={16} />
        Morning workout texts
      </h2>

      {smsConfigured === false && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800 ring-1 ring-amber-200">
          <strong className="font-bold">Texting is not set up yet.</strong> This
          app needs a Twilio account before it can send anything, so the settings
          below will save but no messages will arrive.
        </p>
      )}

      {/* On/off is the first decision, so it leads and states plainly what it means. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-poodle-cream px-4 py-3">
        <div className="flex items-center gap-2.5">
          <BellIcon size={20} muted={!alerts.enabled} />
          <div>
            <div className="text-sm font-bold">
              {alerts.enabled ? "Texts are on" : "Texts are off"}
            </div>
            <div className="text-[11px] text-foreground/55">
              {alerts.enabled
                ? `Every workout morning at ${alerts.time}`
                : "You will not receive any texts"}
            </div>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={alerts.enabled}
          aria-label="Morning workout texts"
          onClick={() => setEnabled(!alerts.enabled)}
          className={`relative h-7 w-12 shrink-0 rounded-full ring-1 transition ${
            alerts.enabled
              ? "bg-headband ring-headband-dark"
              : "bg-foreground/25 ring-foreground/20"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-all ${
              alerts.enabled ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block text-xs font-semibold text-foreground/60">
          Phone number
          <input
            type="tel"
            placeholder="+1 555 123 4567"
            value={alerts.phone}
            onChange={(e) => {
              setSend({ kind: "idle" });
              update((prev) => ({
                ...prev,
                alerts: { ...prev.alerts, phone: e.target.value },
              }));
            }}
            className="mt-1 w-full rounded-xl border border-poodle-fur bg-white px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-headband"
          />
        </label>
        <label className="block text-xs font-semibold text-foreground/60">
          Send at
          <input
            type="time"
            value={alerts.time}
            onChange={(e) =>
              update((prev) => ({
                ...prev,
                alerts: { ...prev.alerts, time: e.target.value },
              }))
            }
            className="mt-1 w-full rounded-xl border border-poodle-fur bg-white px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-headband"
          />
        </label>
      </div>

      {/* Confirmation state for the number itself, separate from on/off. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {confirmed ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-headband-light px-3 py-1.5 text-xs font-bold text-headband-dark">
            <CheckIcon size={12} />
            Number confirmed
          </span>
        ) : (
          <button
            onClick={sendConfirmation}
            disabled={send.kind === "sending" || !alerts.phone}
            className="rounded-full bg-headband px-4 py-2 text-xs font-bold text-white transition hover:bg-headband-dark disabled:opacity-50"
          >
            {send.kind === "sending"
              ? "Sending…"
              : "Send a text to confirm this number"}
          </button>
        )}
        {confirmed && (
          <button
            onClick={sendConfirmation}
            disabled={send.kind === "sending"}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-foreground/60 ring-1 ring-poodle-fur transition hover:bg-poodle-cream disabled:opacity-50"
          >
            Send another
          </button>
        )}
      </div>

      {send.kind === "sent" && (
        <p className="mt-2 text-xs font-semibold text-emerald-700">
          Text sent. Check your phone.
        </p>
      )}
      {send.kind === "error" && (
        <p role="alert" className="mt-2 text-xs font-semibold text-red-600">
          {send.message}
        </p>
      )}

      <div className="mt-3 rounded-xl bg-poodle-cream p-3 text-xs text-foreground/70">
        <span className="font-semibold">Preview:</span> {preview}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-foreground/50">
        Texts go out at your alert time on workout days only, so rest days stay
        quiet. The day before your race you get a pep talk, and on race day a
        good luck text at 7:00am
        {alerts.timezone ? ` (${alerts.timezone.replace(/_/g, " ")})` : ""}.
      </p>
    </section>
  );
}

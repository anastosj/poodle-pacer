"use client";

import { useState } from "react";

/**
 * The join button, plus the choice of whether to take the pack's plan.
 *
 * Defaulted on: someone following a family invite almost always means "put me
 * on what everyone else is doing", and the alternative — six people separately
 * picking the same program and the same start date without a typo — is the
 * thing this is here to remove.
 */
export default function JoinConfirm({
  code,
  packPlan,
}: {
  code: string;
  /** Absent when the pack's owner hasn't set a race date yet. */
  packPlan: { programName: string; startLabel: string } | null;
}) {
  const [adopt, setAdopt] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/races/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, adoptPlan: packPlan ? adopt : false }),
    });
    if (response.ok) {
      window.location.href = "/";
      return;
    }
    setBusy(false);
    setError("That didn't work. Please try again.");
  };

  return (
    <div className="mt-5">
      {packPlan && (
        <label className="flex cursor-pointer items-start gap-2 rounded-sm border-2 border-outline bg-surface-tinted p-3 text-left">
          <input
            type="checkbox"
            checked={adopt}
            onChange={(e) => setAdopt(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span className="type-body text-ink">
            Train on the pack&apos;s plan
            <span className="mt-0.5 block text-meta text-ink-soft">
              {packPlan.programName}, starting {packPlan.startLabel}. This
              replaces the dates on your current plan.
            </span>
          </span>
        </label>
      )}

      <button
        onClick={join}
        disabled={busy}
        className="hard-button focus-pouf mt-4 inline-flex items-center justify-center rounded-sm bg-primary px-6 py-3 text-base font-bold uppercase text-white disabled:opacity-60"
      >
        {busy ? "Joining…" : "Join the pack"}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-meta font-bold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

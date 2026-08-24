"use client";

import { useEffect, useState } from "react";
import GroupBoard from "@/components/GroupBoard";
import { RunnerSummary } from "@/lib/group";
import type { RaceMemberRecord, RaceRecord } from "@/lib/db";
import { useApp } from "@/components/AppContext";

export default function RaceView({
  race,
  races,
  summaries,
  membership,
  currentUserId,
}: {
  race: RaceRecord;
  races: RaceRecord[];
  summaries: RunnerSummary[];
  membership: RaceMemberRecord;
  currentUserId: string;
}) {
  const { state } = useApp();
  const [shareStats, setShareStats] = useState(membership.shareStats);
  const [planId, setPlanId] = useState(membership.planId);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const invitePath = `/join/${race.inviteCode}`;
  const [invite, setInvite] = useState(invitePath);
  const isOwner = race.ownerUserId === currentUserId;

  useEffect(() => {
    setInvite(`${window.location.origin}${invitePath}`);
  }, [invitePath]);

  async function update(body: Record<string, unknown>) {
    const response = await fetch(`/api/races/${race.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setMessage(response.ok ? "Saved." : "Could not save that change.");
  }

  return (
    <>
      {races.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {races.map((item) => (
            <a
              key={item.id}
              href={`/group?race=${encodeURIComponent(item.id)}`}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                item.id === race.id
                  ? "bg-headband text-white"
                  : "bg-poodle-white text-foreground/70 ring-1 ring-poodle-fur"
              }`}
            >
              {item.name}
            </a>
          ))}
        </div>
      )}
      <div className="mt-4 rounded-pouf bg-poodle-white p-4 ring-1 ring-poodle-fur pouf-shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">{race.name}</h2>
            <p className="text-xs text-foreground/55">
              Share only with runners in this pack.
            </p>
          </div>
          {isOwner && (
            <div className="text-right text-xs text-foreground/60">
              <div className="font-semibold">Invite link</div>
              <div className="mt-1 max-w-xs break-all text-[11px]">
                {invite}
              </div>
              <div className="mt-1 flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard?.writeText(invite);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1500);
                    } catch {
                      setCopied(false);
                    }
                  }}
                  className="rounded-full bg-headband px-3 py-1.5 font-bold text-white"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={async () => {
                    const response = await fetch(
                      `/api/races/${race.id}/invite`,
                      { method: "POST" }
                    );
                    if (response.ok) window.location.reload();
                  }}
                  className="rounded-full px-3 py-1.5 font-semibold ring-1 ring-poodle-fur"
                >
                  Rotate
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={shareStats}
              onChange={(event) => {
                setShareStats(event.target.checked);
                void update({ shareStats: event.target.checked });
              }}
            />
            Share my training stats
          </label>
          <select
            value={planId}
            onChange={(event) => {
              setPlanId(event.target.value);
              void update({ planId: event.target.value });
            }}
            className="rounded-xl border border-poodle-fur bg-white px-2 py-1.5 text-sm"
          >
            {state.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name || "Untitled plan"}
              </option>
            ))}
          </select>
          <button
            onClick={async () => {
              if (!window.confirm(`Leave "${race.name}"?`)) return;
              await fetch(`/api/races/${race.id}`, { method: "DELETE" });
              window.location.href = "/group";
            }}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200"
          >
            Leave race
          </button>
          {message && (
            <span className="text-xs text-foreground/55">{message}</span>
          )}
        </div>
      </div>
      <GroupBoard summaries={summaries} currentUserId={currentUserId} />
      {isOwner && summaries.length > 1 && (
        <div className="mt-4 rounded-pouf bg-poodle-white p-4 ring-1 ring-poodle-fur">
          <h3 className="text-sm font-bold">Manage members</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {summaries
              .filter((summary) => summary.userId !== currentUserId)
              .map((summary) => (
                <button
                  key={summary.userId}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        `Remove ${summary.name} from ${race.name}?`
                      )
                    ) {
                      return;
                    }
                    await fetch(
                      `/api/races/${race.id}/members/${encodeURIComponent(
                        summary.userId
                      )}`,
                      { method: "DELETE" }
                    );
                    window.location.reload();
                  }}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200"
                >
                  Remove {summary.name}
                </button>
              ))}
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import AlertsCard from "@/components/AlertsCard";
import PushCard from "@/components/PushCard";
import StravaCard from "@/components/StravaCard";
import { PawIcon, PoodleFaceIcon } from "@/components/Icons";
import { useApp } from "@/components/AppContext";
import Link from "next/link";

export default function SettingsPage() {
  const { user, state, update, plan, program } = useApp();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="type-display">Settings</h1>
      <p className="mt-1 type-body text-ink-muted">
        Profile, notifications, and connections.
      </p>

      <section className="mt-5 rounded-sm border-3 border-outline bg-surface p-5 shadow-card">
        <h2 className="type-overline flex items-center gap-1.5 text-ink-soft">
          <PawIcon size={14} />
          Profile
        </h2>
        <div className="mt-3 flex items-center gap-3">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="h-12 w-12 rounded-full border-2 border-outline object-cover"
            />
          ) : (
            <PoodleFaceIcon size={48} />
          )}
          <div>
            <div className="text-base font-bold">{user.name ?? "Runner"}</div>
            <div className="text-meta text-ink-soft">
              Signed in with Strava · your races, logs, and alerts are private
              to this account.
            </div>
          </div>
        </div>
        <form action="/api/auth/logout" method="post" className="mt-4">
          <button
            type="submit"
            className="focus-pouf rounded-full border-2 border-red-700 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50"
          >
            Sign out
          </button>
        </form>
      </section>

      <PushCard />

      <AlertsCard state={state} update={update} plan={plan} program={program} />

      <Link
        href="/group"
        className="mt-4 block rounded-pouf bg-poodle-white p-4 text-sm font-bold ring-1 ring-poodle-fur pouf-shadow"
      >
        Train with others{" "}
        <span className="float-right text-headband-dark">→</span>
        <span className="mt-1 block text-xs font-normal text-foreground/55">
          Start a pack or join with an invite code.
        </span>
      </Link>

      <div className="mt-4">
        <StravaCard />
      </div>

      <p className="mt-6 flex justify-center gap-4 pb-2 text-meta text-ink-soft">
        <a href="/privacy" className="underline hover:text-foreground/70">
          Privacy Policy
        </a>
        <a href="/terms" className="underline hover:text-foreground/70">
          Terms of Service
        </a>
      </p>
    </div>
  );
}

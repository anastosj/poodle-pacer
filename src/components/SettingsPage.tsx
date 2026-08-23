"use client";

import AlertsCard from "@/components/AlertsCard";
import StravaCard from "@/components/StravaCard";
import { PoodleFaceIcon } from "@/components/Icons";
import { useApp } from "@/components/AppContext";

export default function SettingsPage() {
  const { user, state, update, plan, updatePlan, program } = useApp();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-foreground/60">
        Profile, notifications, and connections.
      </p>

      <section className="mt-5 rounded-pouf bg-poodle-white p-5 ring-1 ring-poodle-fur pouf-shadow">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground/60">
          Profile
        </h2>
        <div className="mt-3 flex items-center gap-3">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="h-12 w-12 rounded-full object-cover ring-1 ring-poodle-fur"
            />
          ) : (
            <PoodleFaceIcon size={48} />
          )}
          <div>
            <div className="text-base font-bold">{user.name ?? "Runner"}</div>
            <div className="text-xs text-foreground/55">
              Signed in with Strava · your races, logs, and alerts are private
              to this account.
            </div>
          </div>
        </div>
        <form action="/api/auth/logout" method="post" className="mt-4">
          <button
            type="submit"
            className="rounded-full px-4 py-2 text-sm font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50"
          >
            Sign out
          </button>
        </form>
      </section>

      <AlertsCard state={state} update={update} plan={plan} program={program} />

      <div className="mt-4">
        <StravaCard plan={plan} updatePlan={updatePlan} program={program} />
      </div>

      <p className="mt-6 flex justify-center gap-4 pb-2 text-xs text-foreground/50">
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

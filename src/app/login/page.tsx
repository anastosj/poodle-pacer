import Link from "next/link";
import { redirect } from "next/navigation";
import PoodleMascot from "@/components/PoodleMascot";
import { currentUserId } from "@/lib/session";
import { stravaConfigured } from "@/lib/strava";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  denied: "You cancelled the Strava sign-in — no harm done, try again whenever.",
  bad_state:
    "That sign-in link expired or didn't match this browser. Please try again.",
  no_code: "Strava didn't send back a login code. Please try again.",
  token_exchange:
    "Couldn't complete the handshake with Strava. Please try again in a moment.",
  not_configured:
    "Strava isn't configured on this server yet, so sign-in is unavailable.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  // Already signed in? Straight to the app.
  if (currentUserId()) redirect("/");

  const error = searchParams.error ? ERRORS[searchParams.error] : null;
  const configured = stravaConfigured();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-pouf bg-poodle-white p-8 text-center ring-1 ring-poodle-fur pouf-shadow">
        <div className="flex justify-center">
          <PoodleMascot size={96} />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
          Poodle Pacer
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          Your half marathon training sidekick. Sign in to pick up your plan
          where you left off.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200"
          >
            {error}
          </p>
        )}

        {configured ? (
          <a
            href="/api/auth/login"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#fc4c02] px-6 py-3 text-base font-bold text-white transition hover:opacity-90"
          >
            Sign in with Strava
          </a>
        ) : (
          <p className="mt-6 rounded-xl bg-poodle-cream px-4 py-3 text-sm text-foreground/70">
            Sign-in is unavailable until <code>STRAVA_CLIENT_ID</code> and{" "}
            <code>STRAVA_CLIENT_SECRET</code> are set on the server.
          </p>
        )}

        <p className="mt-5 text-xs leading-relaxed text-foreground/50">
          We use Strava to sign you in and to import your runs. Your training
          plan is private to your account.
        </p>

        <p className="mt-4 text-xs text-foreground/40">
          <Link href="/" className="underline hover:text-foreground/60">
            Back to the app
          </Link>
        </p>
      </div>
    </main>
  );
}

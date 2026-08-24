import Link from "next/link";
import { redirect } from "next/navigation";
import PoodleMascot from "@/components/PoodleMascot";
import { findUser } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { stravaConfigured } from "@/lib/strava";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  denied: "You cancelled the Strava sign-in. No harm done, try again whenever.",
  bad_state:
    "That sign-in link expired or didn't match this browser. Please try again.",
  no_code: "Strava didn't send back a login code. Please try again.",
  token_exchange:
    "Couldn't complete the handshake with Strava. Please try again in a moment.",
  not_configured:
    "Strava isn't configured on this server yet, so sign-in is unavailable.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  // Only bounce to the app if the session resolves to a real user. Checking the
  // cookie alone would loop forever against requireUser() when the row is gone
  // (deleted account, reset database): / sends here, here sends back to /.
  const userId = currentUserId();
  if (userId && (await findUser(userId))) redirect("/");

  const error = searchParams.error ? ERRORS[searchParams.error] : null;
  const configured = stravaConfigured();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-sm border-3 border-outline bg-surface p-8 text-center shadow-hero">
        <div className="flex justify-center">
          <PoodleMascot size={96} />
        </div>
        <h1 className="type-display mt-4">
          Poodle Pacer
        </h1>
        <p className="mt-1 type-body text-ink-muted">
          Your running and triathlon training sidekick. Sign in to pick up your
          plan where you left off.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-sm border-2 border-red-700 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
          >
            {error}
          </p>
        )}

        {configured ? (
          <a
            href={`/api/auth/login${
              searchParams.next
                ? `?next=${encodeURIComponent(searchParams.next)}`
                : ""
            }`}
            className="hard-button focus-pouf mt-6 inline-flex w-full items-center justify-center gap-2 rounded-sm border-3 border-outline bg-[#fc4c02] px-6 py-3 text-base font-bold uppercase text-white transition hover:opacity-90"
          >
            Sign in with Strava
          </a>
        ) : (
          <p className="mt-6 rounded-sm border-2 border-outline bg-lilac px-4 py-3 type-body text-ink-muted">
            Sign-in is unavailable until <code>STRAVA_CLIENT_ID</code> and{" "}
            <code>STRAVA_CLIENT_SECRET</code> are set on the server.
          </p>
        )}

        <p className="mt-5 text-meta leading-relaxed text-ink-soft">
          We use Strava to sign you in and to import your runs. Your training
          plan is private to your account.
        </p>

        <p className="mt-5 text-meta leading-relaxed text-ink-soft">
          By signing in you agree to the{" "}
          <Link href="/terms" className="underline hover:text-foreground/70">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-foreground/70">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

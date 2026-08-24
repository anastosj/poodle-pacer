import Link from "next/link";
import PoodleMascot from "@/components/PoodleMascot";

/**
 * Chrome for the public policy pages. These sit outside the (app) route group
 * so they stay reachable without signing in, which is what carrier reviewers
 * and app stores check.
 */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen px-4 py-10">
      <article className="mx-auto max-w-2xl">
        <Link href="/" className="flex items-center gap-2">
          <PoodleMascot size={36} />
          <span className="font-display text-base uppercase tracking-tight">
            Poodle Pacer
          </span>
        </Link>

        <h1 className="type-display mt-6">{title}</h1>
        <p className="mt-1 type-body text-ink-soft">Last updated {updated}</p>

        <div className="legal mt-8 space-y-5 type-body leading-relaxed text-ink-muted">
          {children}
        </div>

        <nav className="mt-12 flex gap-4 border-t-2 border-outline pt-5 text-sm">
          <Link href="/privacy" className="font-bold text-primary-dark underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="font-bold text-primary-dark underline">
            Terms of Service
          </Link>
          <Link href="/" className="text-ink-soft underline">
            Back to the app
          </Link>
        </nav>
      </article>
    </main>
  );
}

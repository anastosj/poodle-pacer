"use client";

import { PoodleFaceIcon } from "@/components/Icons";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-pouf bg-poodle-white p-6 text-center ring-1 ring-poodle-fur pouf-shadow">
          <PoodleFaceIcon size={64} className="mx-auto" />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-foreground/60">
            The pack hit a snag. Give it another try.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-5 rounded-full bg-headband px-4 py-2.5 text-sm font-bold text-white transition hover:bg-headband-dark"
          >
            Try again
          </button>
        </section>
      </div>
    </main>
  );
}

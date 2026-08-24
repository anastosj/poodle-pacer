"use client";

import { PoodleFaceIcon } from "@/components/Icons";
import { useRouter } from "next/navigation";
import { startTransition } from "react";

export default function Error({ reset }: { reset: () => void }) {
  const router = useRouter();

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-sm border-3 border-outline bg-surface p-6 text-center shadow-card">
          <PoodleFaceIcon size={64} className="mx-auto" />
          <h1 className="type-title mt-4">
            Something went wrong
          </h1>
          <p className="mt-2 type-body text-ink-muted">
            The pack hit a snag. Give it another try.
          </p>
          <button
            type="button"
            onClick={() => {
              startTransition(() => {
                reset();
                router.refresh();
              });
            }}
            className="hard-button focus-pouf mt-5 rounded-sm bg-primary px-4 py-2.5 text-sm font-bold uppercase text-white"
          >
            Try again
          </button>
        </section>
      </div>
    </main>
  );
}

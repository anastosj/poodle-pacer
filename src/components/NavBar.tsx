"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import PoodleMascot from "@/components/PoodleMascot";
import { useApp } from "@/components/AppContext";
import { RUNNERS } from "@/lib/store";

const LINKS = [
  { href: "/", label: "🏠 Home" },
  { href: "/goals", label: "🎯 Goals" },
  { href: "/settings", label: "⚙️ Settings" },
];

export default function NavBar() {
  const pathname = usePathname();
  const { runner, setRunner } = useApp();

  return (
    <nav className="sticky top-0 z-20 border-b border-poodle-fur bg-poodle-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2">
        <Link href="/" className="flex items-center gap-2">
          <PoodleMascot size={40} />
          <span className="text-lg font-extrabold tracking-tight">
            Poodle Pacer
          </span>
        </Link>
        <div className="hidden gap-1 sm:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                pathname === l.href
                  ? "bg-headband text-white"
                  : "text-foreground/70 hover:bg-poodle-cream"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          {RUNNERS.map((r) => (
            <button
              key={r.id}
              onClick={() => setRunner(r.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                runner === r.id
                  ? "bg-headband text-white pouf-shadow"
                  : "bg-white text-foreground/70 ring-1 ring-poodle-fur hover:bg-poodle-cream"
              }`}
            >
              {r.emoji} {r.name}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

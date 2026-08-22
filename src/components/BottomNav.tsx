"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", emoji: "🏠", label: "Home" },
  { href: "/goals", emoji: "🎯", label: "Goals" },
  { href: "/settings", emoji: "⚙️", label: "Settings" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-poodle-fur bg-poodle-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      <div className="flex">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
              pathname === l.href
                ? "text-headband-dark"
                : "text-foreground/50"
            }`}
          >
            <span className="text-lg leading-none">{l.emoji}</span>
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

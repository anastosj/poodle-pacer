"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BoneIcon,
  ChartIcon,
  HomeIcon,
  PawIcon,
  SettingsIcon,
} from "@/components/Icons";
import { useApp } from "@/components/AppContext";

const LINKS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/progress", label: "Progress", Icon: ChartIcon },
  { href: "/group", label: "Pack", Icon: PawIcon },
  { href: "/goals", label: "Goals", Icon: BoneIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { raceCount } = useApp();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t-3 border-outline bg-lilac/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      <div className="flex">
        {LINKS.filter(
          ({ href }) => href !== "/group" || raceCount > 0
        ).map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`focus-pouf flex flex-1 flex-col items-center gap-1 py-2.5 text-meta font-bold uppercase transition ${
                active ? "text-ink" : "text-ink-soft"
              }`}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-full transition ${
                  active ? "border-2 border-outline bg-highlight" : ""
                }`}
              >
                <Icon size={19} className={active ? "" : "opacity-60"} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

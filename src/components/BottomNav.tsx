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
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t-3 border-outline bg-primary-dark pb-[env(safe-area-inset-bottom)] sm:hidden">
      <div className="flex">
        {LINKS.filter(
          ({ href }) => href !== "/group" || raceCount > 0
        ).map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              // basis-0 with flex-1 gives every tab an equal share, so a wide
              // label like "Progress" and a short one like "Pack" still centre
              // on evenly spaced columns instead of clumping to the left.
              className={`focus-pouf flex min-w-0 flex-1 basis-0 flex-col items-center gap-1 py-2.5 text-meta font-bold uppercase leading-none transition ${
                active ? "text-white" : "text-white/70"
              }`}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-full transition ${
                  active ? "border-2 border-outline bg-highlight" : ""
                }`}
              >
                <Icon size={19} className={active ? "" : "opacity-60"} />
              </span>
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

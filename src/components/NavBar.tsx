"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import PoodleMascot from "@/components/PoodleMascot";
import {
  BoneIcon,
  ChartIcon,
  HomeIcon,
  PawIcon,
  PoodleFaceIcon,
  SettingsIcon,
} from "@/components/Icons";
import { useApp } from "@/components/AppContext";

const LINKS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/progress", label: "Progress", Icon: ChartIcon },
  { href: "/group", label: "The Pack", Icon: PawIcon },
  { href: "/goals", label: "Goals", Icon: BoneIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

function initials(name: string | null): string {
  if (!name) return "";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function NavBar() {
  const pathname = usePathname();
  const { user, raceCount } = useApp();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <nav className="sticky top-0 z-30 border-b-3 border-outline bg-nav text-white backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2.5">
        <Link href="/" className="focus-pouf flex items-center gap-2">
          <PoodleMascot size={40} />
          <span className="font-display text-lg uppercase tracking-tight text-white">
            Poodle Pacer
          </span>
        </Link>
        <div className="hidden gap-1 sm:flex">
          {LINKS.filter(
            ({ href }) => href !== "/group" || raceCount > 0
          ).map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={`focus-pouf flex items-center gap-1.5 rounded-full border-2 border-transparent px-3 py-1.5 text-sm font-bold uppercase transition ${
                pathname === href
                  ? "border-white bg-highlight text-ink"
                  : "text-white/80 hover:border-white hover:bg-white/10"
              }`}
            >
              <Icon
                size={17}
                className={pathname === href ? "opacity-90" : ""}
              />
              {label}
            </Link>
          ))}
        </div>

        <div className="relative ml-auto" ref={menuRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={user.name ?? "My profile"}
            // On a phone the header is tight, so it collapses to just the
            // avatar: a round chip with no name and no padding around it. From
            // sm up the name and caret return.
            className="focus-pouf flex items-center gap-2 rounded-full border-2 border-white bg-white p-0 text-sm font-bold text-ink transition hover:bg-highlight sm:py-1 sm:pl-1 sm:pr-3"
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                className="h-8 w-8 rounded-full border-2 border-outline object-cover sm:h-7 sm:w-7"
              />
            ) : initials(user.name) ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-outline bg-primary text-xs font-bold text-white sm:h-7 sm:w-7">
                {initials(user.name)}
              </span>
            ) : (
              <PoodleFaceIcon size={28} />
            )}
            <span className="hidden max-w-[9rem] truncate sm:inline">
              {user.name ?? "My profile"}
            </span>
            <span className="hidden text-[10px] text-foreground/40 sm:inline">
              ▾
            </span>
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-sm border-3 border-outline bg-surface py-1 shadow-card"
            >
              <div className="border-b-2 border-outline px-4 py-2">
                <div className="truncate text-sm font-bold">
                  {user.name ?? "Runner"}
                </div>
                <div className="text-meta text-ink-soft">
                  Signed in with Strava
                </div>
              </div>
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="focus-pouf flex items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-lilac"
              >
                <SettingsIcon size={15} />
                Settings
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  role="menuitem"
                  className="focus-pouf w-full px-4 py-2 text-left text-sm font-bold text-red-700 hover:bg-red-50"
                >
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

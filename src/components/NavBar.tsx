"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import PoodleMascot from "@/components/PoodleMascot";
import {
  HomeIcon,
  PawIcon,
  PoodleFaceIcon,
  SettingsIcon,
  TargetIcon,
} from "@/components/Icons";
import { useApp } from "@/components/AppContext";

const LINKS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/group", label: "The Pack", Icon: PawIcon },
  { href: "/goals", label: "Goals", Icon: TargetIcon },
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
  const { user } = useApp();
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
    <nav className="sticky top-0 z-30 border-b border-poodle-fur bg-poodle-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2">
        <Link href="/" className="flex items-center gap-2">
          <PoodleMascot size={40} />
          <span className="text-lg font-extrabold tracking-tight">
            Poodle Pacer
          </span>
        </Link>
        <div className="hidden gap-1 sm:flex">
          {LINKS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                pathname === href
                  ? "bg-headband text-white"
                  : "text-foreground/70 hover:bg-poodle-cream"
              }`}
            >
              <Icon size={17} className={pathname === href ? "opacity-90" : ""} />
              {label}
            </Link>
          ))}
        </div>

        <div className="relative ml-auto" ref={menuRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-sm font-semibold text-foreground/80 ring-1 ring-poodle-fur transition hover:bg-poodle-cream"
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                className="h-7 w-7 rounded-full object-cover ring-1 ring-poodle-fur"
              />
            ) : initials(user.name) ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-headband text-xs font-bold text-white">
                {initials(user.name)}
              </span>
            ) : (
              <PoodleFaceIcon size={28} />
            )}
            <span className="max-w-[9rem] truncate">
              {user.name ?? "My profile"}
            </span>
            <span className="text-[10px] text-foreground/40">▾</span>
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl bg-white py-1 ring-1 ring-poodle-fur pouf-shadow"
            >
              <div className="border-b border-poodle-fur px-4 py-2">
                <div className="truncate text-sm font-bold">
                  {user.name ?? "Runner"}
                </div>
                <div className="text-[11px] text-foreground/50">
                  Signed in with Strava
                </div>
              </div>
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-foreground/80 hover:bg-poodle-cream"
              >
                <SettingsIcon size={15} />
                Settings
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  role="menuitem"
                  className="w-full px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
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

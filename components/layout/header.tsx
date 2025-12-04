"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { ThemeToggle } from "./theme-toggle";
import { isDemoMode } from "@/lib/config/demo-mode";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/explorer", label: "Explorer" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings", label: "Settings" },
];

/** Build href respecting demo mode */
function buildHref(baseHref: string, demoMode: boolean): string {
  if (!demoMode) return baseHref;
  return `${baseHref}?demo=1`;
}

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    if (isDemoMode()) setDemoMode(true);
  }, []);

  const toggleMobile = () => setMobileOpen((open) => !open);
  const closeMobile = () => setMobileOpen(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-background/90 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/95">
      {/* Laser beam */}
      <div className="h-[2px] w-full bg-[linear-gradient(90deg,_rgba(251,191,36,0.0)_0%,_rgba(251,191,36,0.85)_25%,_rgba(56,189,248,0.9)_75%,_rgba(251,191,36,0.0)_100%)]" />

      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo + brand */}
        <Link
          href={buildHref("/", demoMode)}
          className="flex items-center gap-3 hover:opacity-90 transition"
        >
          <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-amber-400/70 bg-zinc-900 shadow-[0_0_18px_rgba(251,191,36,0.35)] dark:bg-zinc-950">
            <Image
              src="/logos/zray-logo.png"
              alt="Z-Ray logo"
              width={40}
              height={40}
              className="h-full w-full object-contain"
              priority
            />
          </div>

          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Z-Ray
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Laser-focused Zcash explorer
            </span>
          </div>
        </Link>

        {/* Right cluster */}
        <div className="flex items-center gap-3">
          {/* Desktop nav */}
          <nav className="hidden items-center gap-1.5 text-xs sm:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={buildHref(item.href, demoMode)}
                className={[
                  "rounded-md px-2.5 py-1.5 transition",
                  isActive(item.href)
                    ? "bg-zinc-900 text-amber-200 shadow-[0_0_18px_rgba(15,23,42,0.4)] dark:shadow-[0_0_18px_rgba(251,191,36,0.25)]"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
                ].join(" ")}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Demo badge */}
          {demoMode && (
            <span className="hidden items-center gap-1 rounded-full border border-amber-400/60 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Demo mode
            </span>
          )}

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={toggleMobile}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-xs text-zinc-700 shadow-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:hidden"
            aria-label="Toggle navigation"
          >
            <span className="flex flex-col gap-[3px]">
              <span className="h-[1.5px] w-4 rounded-full bg-current" />
              <span className="h-[1.5px] w-4 rounded-full bg-current" />
              <span className="h-[1.5px] w-4 rounded-full bg-current" />
            </span>
          </button>

          <ThemeToggle />
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="sm:hidden">
          <div className="border-t border-zinc-200 bg-background/95 px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950/95">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={buildHref(item.href, demoMode)}
                  onClick={closeMobile}
                  className={[
                    "rounded-md px-2.5 py-1.5 transition",
                    isActive(item.href)
                      ? "bg-zinc-900 text-amber-200 dark:bg-zinc-900"
                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

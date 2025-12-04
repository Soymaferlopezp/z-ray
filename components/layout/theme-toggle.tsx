"use client";

import { useEffect, useState } from "react";
import { useUISettings } from "@/lib/state/ui-settings-context";

type Theme = "light" | "dark" | "system";

const themeCycle: Theme[] = ["light", "dark", "system"];

export function ThemeToggle() {
  const { theme, setTheme } = useUISettings();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs text-zinc-500 shadow-sm"
        aria-label="Toggle theme"
      >
        ·
      </button>
    );
  }

  const currentTheme: Theme =
    (theme as Theme | null) && ["light", "dark", "system"].includes(theme)
      ? (theme as Theme)
      : "system";

  const handleClick = () => {
    const currentIndex = themeCycle.indexOf(currentTheme);
    const nextTheme = themeCycle[(currentIndex + 1) % themeCycle.length];
    setTheme(nextTheme);
  };

  const labelMap: Record<Theme, string> = {
    light: "Light theme",
    dark: "Dark theme",
    system: "System theme",
  };

  const iconMap: Record<Theme, string> = {
    light: "☀️",
    dark: "🌙",
    system: "💻",
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs text-zinc-100 shadow-[0_0_12px_rgba(15,23,42,0.9)] transition hover:border-amber-400 hover:text-amber-200"
      aria-label={labelMap[currentTheme]}
      title={labelMap[currentTheme]}
    >
      <span className="text-base leading-none">{iconMap[currentTheme]}</span>
    </button>
  );
}

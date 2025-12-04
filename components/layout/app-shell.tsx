"use client";

import type { ReactNode } from "react";
import { Header } from "./header";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* Background layer */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        {/* soft vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.10),_transparent_55%)] dark:bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.9),_transparent_55%)]" />
        {/* grid sólo en dark */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,_rgba(148,163,184,0.12)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(148,163,184,0.12)_1px,_transparent_1px)] bg-[size:40px_40px] opacity-0 dark:opacity-40" />
      </div>

      <Header />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <div
          className="rounded-3xl border border-zinc-800 shadow-[0_25px_80px_rgba(0,0,0,0.9)] backdrop-blur-md"
          style={{ backgroundColor: "#020617" }}
        >
          {children}
        </div>
      </div>

    </div>
  );
}

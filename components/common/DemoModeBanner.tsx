"use client";

import React, { useEffect, useState } from "react";
import { isDemoMode } from "@/lib/config/demo-mode";

export function DemoModeBanner() {
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    if (isDemoMode()) {
      setDemoMode(true);
    }
  }, []);

  if (!demoMode) return null;

  return (
    <div className="mb-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
      <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-400/70 text-[10px] font-bold">
        !
      </span>
      <span className="font-medium">Demo mode:</span>{" "}
      <span className="text-amber-100/90">
        showing simulated data for illustration purposes.
      </span>
    </div>
  );
}

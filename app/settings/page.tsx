"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useNetworkStatus } from "@/lib/lightwalletd/LightwalletdProvider";
import { isDemoMode } from "@/lib/config/demo-mode";

export default function SettingsPage() {
  const router = useRouter();
  const demo = isDemoMode();

  const { loading, error, info, activeEndpoint } = useNetworkStatus();

  const handleGoHome = () => {
    const qs = demo ? "?demo=1" : "";
    router.push("/" + qs);
  };

  // ---------------------------------------------
  // DEMO MODE: do NOT display real endpoint info
  // ---------------------------------------------
  if (demo) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold">Settings</h1>

        <section className="space-y-2 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4">
          <h2 className="font-semibold text-amber-300">Demo mode active</h2>
          <p className="text-sm text-amber-200">
            In demo mode, Z-Ray does not connect to real lightwalletd endpoints.
            The explorer and dashboard display simulated data only.
          </p>
          <button
            onClick={handleGoHome}
            className="mt-2 rounded-md bg-amber-400 px-4 py-2 text-xs font-medium text-zinc-900 shadow hover:bg-amber-300"
          >
            Back to home
          </button>
        </section>

        <section className="space-y-1">
          <h2 className="font-semibold">Network status (simulated)</h2>
          <div className="text-sm space-y-1 text-zinc-300">
            <p>
              <span className="font-medium">Chain:</span> mainnet (simulated)
            </p>
            <p>
              <span className="font-medium">Latest block height:</span>{" "}
              2,192,345 (simulated)
            </p>
            <p>
              <span className="font-medium">Vendor:</span> mock-lightwalletd
            </p>
          </div>

          <div className="text-xs text-zinc-400 space-y-1 mt-2">
            <p className="font-semibold">Active endpoint</p>
            <p>
              <span className="font-medium">ID:</span> demo-endpoint
            </p>
            <p>
              <span className="font-medium">URL:</span> https://demo-lightd/zray
            </p>
          </div>
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------
  // REAL MODE — ORIGINAL BEHAVIOR (unchanged)
  // ---------------------------------------------------------
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>

      <section className="space-y-1">
        <h2 className="font-semibold">Zcash network status</h2>

        {loading && <p>Loading network status…</p>}

        {error && (
          <p className="text-sm text-red-500">
            Failed to load network status: {error}
          </p>
        )}

        {!loading && !error && info && (
          <div className="text-sm space-y-1">
            <p>
              <span className="font-medium">Chain:</span> {info.chainName}
            </p>
            <p>
              <span className="font-medium">Latest block height:</span>{" "}
              {info.blockHeight.toLocaleString()}
            </p>
            <p>
              <span className="font-medium">Vendor:</span>{" "}
              {info.vendor ?? "unknown"}
            </p>
          </div>
        )}

        {!loading && activeEndpoint && (
          <div className="text-xs text-neutral-500 space-y-1 mt-2">
            <p className="font-semibold">Active endpoint</p>
            <p>
              <span className="font-medium">ID:</span> {activeEndpoint.id}
            </p>
            <p>
              <span className="font-medium">URL:</span> {activeEndpoint.url}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

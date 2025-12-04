"use client";

import { useNetworkStatus } from "@/lib/lightwalletd/LightwalletdProvider";

export default function SettingsPage() {
  const { loading, error, info, activeEndpoint } = useNetworkStatus();

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
              <span className="font-medium">Vendor:</span> {info.vendor ?? "unknown"}
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

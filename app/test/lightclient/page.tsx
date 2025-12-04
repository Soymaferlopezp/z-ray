"use client";

import { useState } from "react";
import {
  createZRayLightClient,
  type ZRayLightClient,
  type LightClientSyncStatus,
  type DecryptedTransaction,
  type ZRayBalances,
} from "@/lib/wasm/lightclient";
import { createLightwalletdClient } from "@/lib/lightwalletd/client";
import type { ZcashNetwork } from "@/lib/lightwalletd/endpoints";

interface LogEntry {
  id: number;
  message: string;
}

const TEST_NETWORK: ZcashNetwork = "mainnet";

export default function LightclientTestPage() {
  const [client, setClient] = useState<ZRayLightClient | null>(null);
  const [syncStatus, setSyncStatus] = useState<LightClientSyncStatus>({
    stage: "idle",
    progress: 0,
  });
  const [snapshot, setSnapshot] = useState<{
    transactions: DecryptedTransaction[];
    balances: ZRayBalances | null;
  }>({
    transactions: [],
    balances: null,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  function pushLog(message: string) {
    setLogs((prev) => [
      { id: Date.now(), message },
      ...prev.slice(0, 50), // keep last 50 entries
    ]);
  }

  async function handleInit() {
    try {
      setIsBusy(true);
      pushLog("🔵 init() called");
      const lightwalletdClient = createLightwalletdClient({
        network: TEST_NETWORK,
      });

      const lc = createZRayLightClient({
        network: TEST_NETWORK,
        lightwalletdClient,
      });

      await lc.init();
      pushLog("✅ init() resolved");
      setClient(lc);

      const status = await lc.getSyncStatus();
      setSyncStatus(status);
    } catch (err) {
      console.error(err);
      pushLog(`❌ init() failed: ${(err as Error).message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSetViewingKey() {
    if (!client) {
      pushLog("⚠ setViewingKey() called without client");
      return;
    }

    try {
      setIsBusy(true);
      pushLog("🔵 setViewingKey() called");
      await client.setViewingKey({
        ufvk: "uviewkey_dummy_test_only_do_not_use_on_mainnet",
      });
      pushLog("✅ setViewingKey() resolved");

      const status = await client.getSyncStatus();
      setSyncStatus(status);
    } catch (err) {
      console.error(err);
      pushLog(`❌ setViewingKey() failed: ${(err as Error).message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSync() {
    if (!client) {
      pushLog("⚠ sync() called without client");
      return;
    }

    try {
      setIsBusy(true);
      pushLog("🔵 sync() called");
      await client.sync();
      pushLog("✅ sync() resolved");

      const status = await client.getSyncStatus();
      setSyncStatus(status);
    } catch (err) {
      console.error(err);
      pushLog(`❌ sync() failed: ${(err as Error).message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSnapshot() {
    if (!client) {
      pushLog("⚠ getDecryptedSnapshot() called without client");
      return;
    }

    try {
      setIsBusy(true);
      pushLog("🔵 getDecryptedSnapshot() called");
      const snap = await client.getDecryptedSnapshot();
      setSnapshot(snap);
      pushLog(
        `✅ snapshot received: ${snap.transactions.length} tx, balances: ${
          snap.balances
            ? `${snap.balances.confirmed} confirmed / ${snap.balances.unconfirmed} unconfirmed`
            : "null"
        }`
      );
    } catch (err) {
      console.error(err);
      pushLog(`❌ getDecryptedSnapshot() failed: ${(err as Error).message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleClear() {
    if (!client) {
      pushLog("⚠ clearSession() called without client");
      return;
    }

    try {
      setIsBusy(true);
      pushLog("🔵 clearSession() called");
      await client.clearSession();
      pushLog("✅ clearSession() resolved");

      setClient(null);
      setSyncStatus({
        stage: "idle",
        progress: 0,
      });
      setSnapshot({
        transactions: [],
        balances: null,
      });
    } catch (err) {
      console.error(err);
      pushLog(`❌ clearSession() failed: ${(err as Error).message}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Z-Ray Light Client – Test Harness
          </h1>
          <p className="text-sm text-neutral-500">
            Manual test page for the WASM bridge + worker. This page is not part of the
            public product; it is only for internal validation.
          </p>
        </header>

        <section className="border rounded-xl p-4 space-y-4">
          <h2 className="text-lg font-medium">Controls</h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleInit}
              disabled={isBusy || !!client}
              className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50"
            >
              Init client
            </button>
            <button
              type="button"
              onClick={handleSetViewingKey}
              disabled={isBusy || !client}
              className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50"
            >
              Set viewing key (dummy)
            </button>
            <button
              type="button"
              onClick={handleSync}
              disabled={isBusy || !client}
              className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50"
            >
              Sync (mock)
            </button>
            <button
              type="button"
              onClick={handleSnapshot}
              disabled={isBusy || !client}
              className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50"
            >
              Get decrypted snapshot
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={isBusy || !client}
              className="px-3 py-1.5 rounded-md border text-sm text-red-600 border-red-400 disabled:opacity-50"
            >
              Clear session
            </button>
          </div>
          {isBusy && (
            <p className="text-xs text-neutral-500 mt-1">
              Worker running… (this page should never freeze the UI).
            </p>
          )}
        </section>

        <section className="border rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-medium">Sync status</h2>
          <pre className="bg-neutral-950 text-neutral-50 text-xs rounded-md p-3 overflow-x-auto">
            {JSON.stringify(syncStatus, null, 2)}
          </pre>
        </section>

        <section className="border rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-medium">Decrypted snapshot</h2>
          <pre className="bg-neutral-950 text-neutral-50 text-xs rounded-md p-3 overflow-x-auto">
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        </section>

        <section className="border rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-medium">Logs</h2>
          <div className="bg-neutral-950 text-neutral-50 text-xs rounded-md p-3 h-52 overflow-y-auto space-y-1">
            {logs.length === 0 && (
              <p className="text-neutral-500">No logs yet. Use the controls above.</p>
            )}
            {logs.map((log) => (
              <div key={log.id}>{log.message}</div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

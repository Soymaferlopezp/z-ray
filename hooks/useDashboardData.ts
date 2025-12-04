// hooks/useDashboardData.ts

"use client";

import { useEffect, useState } from "react";
import { useZRaySession } from "@/lib/state/session-context";
import { useSensitiveData } from "@/lib/state/sensitive-data-context";
import {
  DashboardData,
  DashboardFilters,
  DecryptedTransaction,
  ZRayBalances,
} from "@/lib/analytics/types";
import { computeDashboardData } from "@/lib/analytics/dashboard";
import { generateMockTransactions } from "@/lib/analytics/mock";
import { isDemoMode } from "@/lib/config/demo-mode";

export type DashboardStatus =
  | "no-session"
  | "initializing"
  | "syncing"
  | "empty"
  | "ready"
  | "error";

export interface UseDashboardDataResult {
  status: DashboardStatus;
  data: DashboardData | null;
  transactions: DecryptedTransaction[];
  balances: ZRayBalances | null;
}

// En producción, esto debe seguir respetando la flag de mock
// cuando NO estás en demo, para ambientes sin actividad real.
const ENABLE_MOCK =
  process.env.NEXT_PUBLIC_ZRAY_ENABLE_DASHBOARD_MOCK === "true";

export function useDashboardData(
  filters: DashboardFilters
): UseDashboardDataResult {
  const { state } = useZRaySession();
  const { decryptedTransactions, balances, lastError } = useSensitiveData();

  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    if (isDemoMode()) {
      setDemoMode(true);
    }
  }, []);

  const phase = state.phase;
  const hasViewingKey = state.hasViewingKey;

  // ---------------- DEMO MODE: siempre dashboard completo ----------------
  if (demoMode) {
    const demoTxs: DecryptedTransaction[] = generateMockTransactions(64);
    const data: DashboardData = computeDashboardData(
      demoTxs,
      null,
      filters
    );

    return {
      status: "ready",
      data,
      transactions: demoTxs,
      balances: null,
    };
  }
  // ----------------------------------------------------------------------

  // Modo real: sin sesión -> no-session
  if (!hasViewingKey || phase === "NO_SESSION") {
    return {
      status: "no-session",
      data: null,
      transactions: [],
      balances: null,
    };
  }

  if (
    phase === "INITIALIZING" ||
    phase === "READY_TO_SYNC" ||
    phase === "SYNCING" ||
    phase === "SCANNING"
  ) {
    return {
      status: "syncing",
      data: null,
      transactions: [],
      balances: balances ?? null,
    };
  }

  if (phase === "ERROR") {
    return {
      status: "error",
      data: null,
      transactions: decryptedTransactions ?? [],
      balances: balances ?? null,
    };
  }

  // LIVE (modo real)
  const baseTxs: DecryptedTransaction[] =
    decryptedTransactions && decryptedTransactions.length > 0
      ? decryptedTransactions
      : [];

  let transactions: DecryptedTransaction[];

  if (baseTxs.length === 0 && ENABLE_MOCK) {
    // Fallback de mock cuando no hay actividad real
    transactions = generateMockTransactions(32);
  } else {
    transactions = baseTxs;
  }

  if (transactions.length === 0) {
    return {
      status: lastError ? "error" : "empty",
      data: null,
      transactions,
      balances: balances ?? null,
    };
  }

  const data: DashboardData = computeDashboardData(
    transactions,
    balances ?? null,
    filters
  );

  return {
    status: "ready",
    data,
    transactions,
    balances: balances ?? null,
  };
}

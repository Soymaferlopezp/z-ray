// hooks/useDashboardData.ts

"use client";

import { useMemo } from "react";
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

// In production this must be "false" so the dashboard only uses
// real decrypted data from the light client and worker.
const ENABLE_MOCK =
  process.env.NEXT_PUBLIC_ZRAY_ENABLE_DASHBOARD_MOCK === "true";


export function useDashboardData(
  filters: DashboardFilters
): UseDashboardDataResult {
  const { state } = useZRaySession();
  const { decryptedTransactions, balances, lastError } = useSensitiveData();

  const phase = state.phase;
  const hasViewingKey = state.hasViewingKey;

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

  // LIVE
  const baseTxs: DecryptedTransaction[] =
    decryptedTransactions && decryptedTransactions.length > 0
      ? decryptedTransactions
      : [];

  const transactions: DecryptedTransaction[] =
    baseTxs.length === 0 && ENABLE_MOCK
      ? generateMockTransactions(32)
      : baseTxs;

  if (transactions.length === 0) {
    return {
      status: lastError ? "error" : "empty",
      data: null,
      transactions,
      balances: balances ?? null,
    };
  }

  const data: DashboardData = useMemo(
    () => computeDashboardData(transactions, balances ?? null, filters),
    [
      transactions,
      balances, // ya no accedemos a .total, solo a la referencia
      filters.fromTimestamp,
      filters.toTimestamp,
      filters.direction,
      filters.pool,
      filters.granularity,
    ]
  );

  return {
    status: "ready",
    data,
    transactions,
    balances: balances ?? null,
  };
}

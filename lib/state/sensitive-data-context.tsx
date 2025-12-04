"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

import type {
  ZRayLightClient,
  DecryptedTransaction as LightClientDecryptedTransaction,
  ZRayBalances as LightClientZRayBalances,
} from "../wasm/lightclient";
import { generateMockTransactions } from "../analytics/mock";
import { isDemoMode } from "../config/demo-mode";

/**
 * These types are just aliases to the shapes defined by the WASM light client.
 * We do NOT redefine the structure here to avoid divergence.
 *
 * All of this data is sensitive and must live only in memory.
 */

export type DecryptedTransaction = LightClientDecryptedTransaction;
export type ZRayBalances = LightClientZRayBalances;

/**
 * Internal state shape for the sensitive data store.
 * All of this lives only in RAM.
 */
interface SensitiveDataState {
  decryptedTransactions: DecryptedTransaction[];
  balances: ZRayBalances | null;
  isRefreshing: boolean;
  lastUpdatedAt: number | null;
  lastError: Error | null;
}

/**
 * Public API exposed by the SensitiveDataContext.
 */
export interface SensitiveDataContextValue {
  decryptedTransactions: DecryptedTransaction[];
  balances: ZRayBalances | null;
  isRefreshing: boolean;
  lastUpdatedAt: number | null;
  lastError: Error | null;
  refreshFromLightClient: () => Promise<void>;
  clearSensitiveData: () => void;
}

const SensitiveDataContext = createContext<SensitiveDataContextValue | undefined>(
  undefined,
);

interface SensitiveDataProviderProps {
  children: ReactNode;

  /**
   * Optional function to access the underlying ZRayLightClient.
   *
   * This is intentionally a callback instead of a direct reference, so that
   * the session layer (ZRaySessionProvider) can own the client and we only
   * "borrow" it when refreshing data.
   *
   * It is expected that in the app-level providers we wire something like:
   *
   * <ZRaySessionProvider>
   *   <SensitiveDataProvider getLightClient={() => sessionLightClient}>
   *     {children}
   *   </SensitiveDataProvider>
   * </ZRaySessionProvider>
   */
  getLightClient?: () => ZRayLightClient | null;
}

/**
 * Provider that holds decrypted transactions and balances in memory.
 *
 * Privacy:
 * - Everything here is sensitive and MUST live only in RAM.
 * - No persistence, no logging of actual values.
 */
export function SensitiveDataProvider({
  children,
  getLightClient,
}: SensitiveDataProviderProps) {
  const [state, setState] = useState<SensitiveDataState>({
    decryptedTransactions: [],
    balances: null,
    isRefreshing: false,
    lastUpdatedAt: null,
    lastError: null,
  });

  const refreshFromLightClient = useCallback(async () => {
    // DEMO MODE: generate a local snapshot without touching the light client / worker.
    if (isDemoMode()) {
      setState((prev) => ({
        ...prev,
        isRefreshing: true,
        lastError: null,
      }));

      const transactions = generateMockTransactions(48);

      const balances: ZRayBalances = {
        confirmed: 12.3456,
        unconfirmed: 0.1234,
      };

      setState({
        decryptedTransactions: transactions,
        balances,
        isRefreshing: false,
        lastUpdatedAt: Date.now(),
        lastError: null,
      });

      return;
    }

    const lightClient = getLightClient ? getLightClient() : null;

    if (!lightClient) {
      // No light client available; we treat this as a non-fatal error.
      setState((prev) => ({
        ...prev,
        lastError: new Error("Light client is not available"),
      }));
      return;
    }

    try {
      setState((prev) => ({
        ...prev,
        isRefreshing: true,
        lastError: null,
      }));

      // Prefer a single snapshot call to keep transactions and balances
      // consistent and reduce worker roundtrips.
      const snapshot = await lightClient.getDecryptedSnapshot();

      setState({
        decryptedTransactions: snapshot.transactions ?? [],
        balances: snapshot.balances ?? null,
        isRefreshing: false,
        lastUpdatedAt: Date.now(),
        lastError: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isRefreshing: false,
        lastError:
          err instanceof Error
            ? err
            : new Error("Failed to refresh sensitive data from light client"),
      }));
    }
  }, [getLightClient]);

  const clearSensitiveData = useCallback(() => {
    setState({
      decryptedTransactions: [],
      balances: null,
      isRefreshing: false,
      lastUpdatedAt: null,
      lastError: null,
    });
  }, []);

  const value: SensitiveDataContextValue = {
    decryptedTransactions: state.decryptedTransactions,
    balances: state.balances,
    isRefreshing: state.isRefreshing,
    lastUpdatedAt: state.lastUpdatedAt,
    lastError: state.lastError,
    refreshFromLightClient,
    clearSensitiveData,
  };

  return (
    <SensitiveDataContext.Provider value={value}>
      {children}
    </SensitiveDataContext.Provider>
  );
}

/**
 * Hook used by the UI (and analytics layer) to access decrypted data.
 *
 * Example usage:
 * const {
 *   decryptedTransactions,
 *   balances,
 *   refreshFromLightClient,
 *   clearSensitiveData,
 * } = useSensitiveData();
 */
export function useSensitiveData(): SensitiveDataContextValue {
  const ctx = useContext(SensitiveDataContext);
  if (!ctx) {
    throw new Error(
      "useSensitiveData must be used within a SensitiveDataProvider",
    );
  }
  return ctx;
}

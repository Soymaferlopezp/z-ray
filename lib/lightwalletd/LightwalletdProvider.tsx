"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import type { ReactNode } from "react";

import {
  ZcashNetwork,
  LightwalletdEndpoint,
} from "./endpoints";
import {
  createLightwalletdClient,
  LightwalletdClient,
  LightdInfo,
} from "./client";

// ---- Context types ----

interface LightwalletdContextValue {
  client: LightwalletdClient | null;
  network: ZcashNetwork;
}

const LightwalletdContext = createContext<LightwalletdContextValue | null>(null);


// ---- Provider ----

interface LightwalletdProviderProps {
  network?: ZcashNetwork;
  children: ReactNode;
}

/**
 * LightwalletdProvider is a client-side provider that creates a single
 * LightwalletdClient instance for the given network and exposes it via React context.
 */
export function LightwalletdProvider({
  network = "mainnet",
  children,
}: LightwalletdProviderProps) {
  const client = useMemo(() => {
    try {
      return createLightwalletdClient({ network });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to create LightwalletdClient:", err);
      return null;
    }
  }, [network]);

  const value: LightwalletdContextValue = {
    client,
    network,
  };

  return (
    <LightwalletdContext.Provider value={value}>
      {children}
    </LightwalletdContext.Provider>
  );
}

// ---- Hooks ----

/**
 * Returns the current LightwalletdClient from context.
 * Throws if used outside of LightwalletdProvider.
 */
export function useLightwalletdClient(): LightwalletdClient {
  const ctx = useContext(LightwalletdContext);

  if (!ctx || !ctx.client) {
    throw new Error(
      "useLightwalletdClient must be used inside a LightwalletdProvider with a valid client"
    );
  }

  return ctx.client;
}

/**
 * Basic network status representation for the UI.
 */
export interface NetworkStatus {
  loading: boolean;
  error?: string;
  info?: LightdInfo;
  activeEndpoint?: LightwalletdEndpoint | null;
}

/**
 * useNetworkStatus calls lightwalletd.getLightdInfo() on mount and exposes:
 * - loading / error
 * - LightdInfo
 * - active endpoint information
 */
export function useNetworkStatus(): NetworkStatus {
  const ctx = useContext(LightwalletdContext);
  const client = ctx?.client ?? null;

  const [status, setStatus] = useState<NetworkStatus>({
    loading: true,
    error: undefined,
    info: undefined,
    activeEndpoint: undefined,
  });

  useEffect(() => {
    // Si no hay cliente, dejamos el estado en error y salimos.
    if (!client) {
      setStatus({
        loading: false,
        error: "No LightwalletdClient available",
        info: undefined,
        activeEndpoint: undefined,
      });
      return;
    }

    let cancelled = false;

    // OJO: el cliente se pasa como parámetro, con tipo no-null.
    async function load(currentClient: LightwalletdClient) {
      setStatus((prev) => ({ ...prev, loading: true, error: undefined }));

      try {
        const info = await currentClient.getLightdInfo();
        const activeEndpoint = currentClient.getActiveEndpoint();

        if (cancelled) return;

        setStatus({
          loading: false,
          error: undefined,
          info,
          activeEndpoint,
        });
      } catch (err: any) {
        if (cancelled) return;

        setStatus({
          loading: false,
          error: err?.message ?? "Failed to load network status",
          info: undefined,
          activeEndpoint: undefined,
        });
      }
    }

    // Llamamos con el cliente ya filtrado
    load(client);

    return () => {
      cancelled = true;
    };
  }, [client]);

  return status;
}




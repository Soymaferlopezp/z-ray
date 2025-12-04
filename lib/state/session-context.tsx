"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

import type { ZcashNetwork } from "../config/network-types";
import {
  INITIAL_ZRAY_SESSION_STATE,
  type ZRaySessionAction,
  type ZRaySessionState,
  type ZRaySessionError,
} from "./session-types";
import {
  createLightwalletdClient,
  type LightwalletdClient,
} from "../lightwalletd/client";
import {
  createZRayLightClient,
  type ZRayLightClient,
} from "../wasm/lightclient";

/**
 * Public API exposed by the session context to the UI.
 */
export interface ZRaySessionContextValue {
  state: ZRaySessionState;
  startSession: (params: { ufvk: string; network: ZcashNetwork }) => Promise<void>;
  syncNow: () => Promise<void>;
  clearSession: () => Promise<void>;

  /**
   * Returns the underlying ZRayLightClient instance owned by this provider,
   * or null if the session has not been initialized yet.
   *
   * Privacy:
   * - This does NOT expose the viewing key.
   * - The viewing key only lives inside the worker / WASM.
   */
  getLightClient: () => ZRayLightClient | null;
}

/**
 * Internal reducer handling Z-Ray session state transitions.
 *
 * Important: it NEVER receives or stores the full viewing key.
 */
function sessionReducer(
  state: ZRaySessionState,
  action: ZRaySessionAction,
): ZRaySessionState {
  const now = Date.now();

  switch (action.type) {
    case "SESSION_INIT": {
      const { sessionId, network, hasViewingKey, createdAt } = action.payload;
      return {
        sessionId,
        phase: "INITIALIZING",
        network,
        hasViewingKey,
        lastError: null,
        createdAt: createdAt ?? now,
        updatedAt: now,
      };
    }

    case "SESSION_SET_PHASE": {
      return {
        ...state,
        phase: action.payload.phase,
        updatedAt: now,
      };
    }

    case "SESSION_SET_ERROR": {
      return {
        ...state,
        lastError: action.payload.error,
        phase: action.payload.error ? "ERROR" : state.phase,
        updatedAt: now,
      };
    }

    case "SESSION_UPDATE_NETWORK": {
      return {
        ...state,
        network: action.payload.network,
        updatedAt: now,
      };
    }

    case "SESSION_SET_HAS_VIEWING_KEY": {
      return {
        ...state,
        hasViewingKey: action.payload.hasViewingKey,
        updatedAt: now,
      };
    }

    case "SESSION_CLEAR": {
      return {
        ...INITIAL_ZRAY_SESSION_STATE,
        updatedAt: now,
      };
    }

    default:
      return state;
  }
}

const ZRaySessionContext = createContext<ZRaySessionContextValue | undefined>(
  undefined,
);

interface ZRaySessionProviderProps {
  children: ReactNode;
}

/**
 * Top-level provider responsible for:
 * - Owning the ZRay session state.
 * - Creating and managing the Lightwalletd client.
 * - Creating and managing the ZRay WASM light client.
 *
 * Privacy:
 * - The viewing key is accepted only by startSession(...).
 * - It is forwarded directly to the light client and never stored in React state.
 */
export function ZRaySessionProvider({ children }: ZRaySessionProviderProps) {
  const [state, dispatch] = useReducer(
    sessionReducer,
    INITIAL_ZRAY_SESSION_STATE,
  );

  const lightwalletdClientRef = useRef<LightwalletdClient | null>(null);
  const lightClientRef = useRef<ZRayLightClient | null>(null);

  // Helper to teardown the light client if it exposes a destroy() method.
  // We do not require destroy() in the ZRayLightClient type to keep the API flexible.
  async function destroyLightClientIfPossible(client: ZRayLightClient | null) {
    if (!client) return;

    const maybeDestroy = (client as unknown as { destroy?: () => Promise<void> | void }).destroy;

    if (typeof maybeDestroy === "function") {
      try {
        await maybeDestroy();
      } catch {
        // Ignore teardown errors here; the session state will still be cleared.
      }
    }
  }

  /**
   * Creates and/or replaces the underlying clients for a given network.
   * Any previous client instances are discarded.
   */
  const ensureClientsForNetwork = useCallback(
    async (network: ZcashNetwork) => {
      await destroyLightClientIfPossible(lightClientRef.current);

      // Create a fresh Lightwalletd client for the requested network.
      lightwalletdClientRef.current = createLightwalletdClient({ network });

      // Create a fresh ZRay light client bound to the Lightwalletd client.
      lightClientRef.current = await createZRayLightClient({
        network,
        lightwalletdClient: lightwalletdClientRef.current,
      });
    },
    [],
  );

  /**
   * Starts a new Z-Ray session given a unified viewing key (ufvk) and network.
   *
   * Privacy:
   * - The ufvk is not stored in React state, context, or any persistent storage.
   * - It is only passed to the WASM light client once and then discarded.
   */
  const startSession = useCallback(
    async ({ ufvk, network }: { ufvk: string; network: ZcashNetwork }) => {
      // Generate an ephemeral session id. This is safe because it contains no sensitive data.
      const sessionId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      dispatch({
        type: "SESSION_INIT",
        payload: {
          sessionId,
          network,
          hasViewingKey: true,
          createdAt: Date.now(),
        },
      });

      try {
        // Prepare underlying clients for the selected network.
        await ensureClientsForNetwork(network);

        const lightClient = lightClientRef.current;
        if (!lightClient) {
          throw new Error("Light client not available after initialization");
        }

        // Pass the viewing key to the WASM light client.
        await lightClient.setViewingKey({ ufvk });

        // At this point the viewing key has been handed over to the WASM client
        // and can be considered out of React's reach.
        dispatch({
          type: "SESSION_SET_PHASE",
          payload: { phase: "READY_TO_SYNC" },
        });
        dispatch({
          type: "SESSION_SET_ERROR",
          payload: { error: null },
        });
      } catch (err) {
        const error: ZRaySessionError = {
          code: "SESSION_INIT_FAILED",
          message:
            err instanceof Error
              ? err.message
              : "Failed to initialize Z-Ray session",
          fatal: true,
        };

        dispatch({
          type: "SESSION_SET_ERROR",
          payload: { error },
        });
      } finally {
        // Best-effort logical wipe of local variable (not strong security, but avoids accidental reuse).
        // eslint-disable-next-line no-param-reassign
        ufvk = "";
      }
    },
    [ensureClientsForNetwork],
  );

  /**
   * Triggers a sync+scan process using the underlying light client.
   *
   * NOTE:
   * - This implementation can be evolved to call lightClient.fullSync()
   *   once that method is available in the WASM bridge.
   * - The SensitiveDataProvider is responsible for pulling decrypted
   *   snapshots into React memory after a successful sync.
   */
  const syncNow = useCallback(async () => {
    // If we are not in a state where syncing makes sense, just no-op.
    if (state.phase !== "READY_TO_SYNC" && state.phase !== "LIVE") {
      return;
    }

    const lightClient = lightClientRef.current;
    if (!lightClient) {
      const error: ZRaySessionError = {
        code: "LIGHT_CLIENT_NOT_READY",
        message: "Light client is not ready to sync",
        fatal: false,
      };
      dispatch({ type: "SESSION_SET_ERROR", payload: { error } });
      return;
    }

    try {
      dispatch({
        type: "SESSION_SET_PHASE",
        payload: { phase: "SYNCING" },
      });

      // TODO: replace with real full sync pipeline:
      // await lightClient.fullSync();

      // For now we simulate a simple phase transition.
      dispatch({
        type: "SESSION_SET_PHASE",
        payload: { phase: "SCANNING" },
      });

      dispatch({
        type: "SESSION_SET_PHASE",
        payload: { phase: "LIVE" },
      });

      dispatch({
        type: "SESSION_SET_ERROR",
        payload: { error: null },
      });
    } catch (err) {
      const error: ZRaySessionError = {
        code: "SYNC_FAILED",
        message:
          err instanceof Error ? err.message : "Failed to sync and scan data",
        fatal: false,
      };
      dispatch({
        type: "SESSION_SET_ERROR",
        payload: { error },
      });
    }
  }, [state.phase]);

  /**
   * Clears the current session and tears down underlying clients.
   * This is the main entry point for "log out / wipe session" in the UI.
   */
  const clearSession = useCallback(async () => {
    // Best-effort teardown of the light client, wiping any in-memory keys.
    await destroyLightClientIfPossible(lightClientRef.current);

    lightClientRef.current = null;
    lightwalletdClientRef.current = null;

    dispatch({ type: "SESSION_CLEAR" });
  }, []);

  /**
   * Returns the underlying ZRayLightClient instance, if any.
   * This is used by the SensitiveDataProvider to pull decrypted snapshots.
   */
  const getLightClient = useCallback((): ZRayLightClient | null => {
    return lightClientRef.current;
  }, []);

  const value: ZRaySessionContextValue = {
    state,
    startSession,
    syncNow,
    clearSession,
    getLightClient,
  };

  return (
    <ZRaySessionContext.Provider value={value}>
      {children}
    </ZRaySessionContext.Provider>
  );
}

/**
 * Hook used by the UI to interact with the Z-Ray session.
 *
 * Example usage in /explorer:
 * const { state, startSession, syncNow, clearSession } = useZRaySession();
 */
export function useZRaySession(): ZRaySessionContextValue {
  const ctx = useContext(ZRaySessionContext);
  if (!ctx) {
    throw new Error("useZRaySession must be used within a ZRaySessionProvider");
  }
  return ctx;
}

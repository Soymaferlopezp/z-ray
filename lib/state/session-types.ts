import type { ZcashNetwork } from "../config/network-types";

/**
 * High-level lifecycle of a Z-Ray session.
 *
 * NO_SESSION     → No active session, user has not provided a viewing key yet.
 * INITIALIZING   → The session is being created (binding network, worker, light client).
 * READY_TO_SYNC  → Light client is ready, viewing key has been set and validated.
 * SYNCING        → Synchronizing chain data (headers / blocks) from lightwalletd.
 * SCANNING       → Scanning synchronized data for shielded transactions.
 * LIVE           → Initial scan complete, following new blocks in near real-time.
 * ERROR          → Terminal or recoverable error; UI should show feedback and options.
 */
export type ZRaySessionPhase =
  | "NO_SESSION"
  | "INITIALIZING"
  | "READY_TO_SYNC"
  | "SYNCING"
  | "SCANNING"
  | "LIVE"
  | "ERROR";

export interface ZRaySessionError {
  code: string;      // e.g. "INVALID_VIEWING_KEY", "ENDPOINT_UNAVAILABLE"
  message: string;   // human-readable message for the UI
  fatal?: boolean;   // if true, the session cannot recover and must be cleared
}

/**
 * Minimal state describing the current Z-Ray session.
 *
 * Important:
 * - The viewing key MUST NEVER be stored here.
 * - This state is safe to expose to the UI and devtools.
 */
export interface ZRaySessionState {
  sessionId: string | null;
  phase: ZRaySessionPhase;
  network: ZcashNetwork | null;
  hasViewingKey: boolean;
  lastError: ZRaySessionError | null;

  /**
   * Optional metadata that can be useful for debugging and UX,
   * but does not contain any sensitive information.
   */
  createdAt?: number | null;   // timestamp in ms
  updatedAt?: number | null;   // timestamp in ms
}

/**
 * Initial state used by the session reducer and provider.
 */
export const INITIAL_ZRAY_SESSION_STATE: ZRaySessionState = {
  sessionId: null,
  phase: "NO_SESSION",
  network: null,
  hasViewingKey: false,
  lastError: null,
  createdAt: null,
  updatedAt: null,
};

/**
 * Actions used by the ZRay session reducer.
 *
 * The reducer must respect the privacy model:
 * - It never receives or stores the full viewing key.
 * - It only works with non-sensitive metadata (flags, ids, timestamps).
 */
export type ZRaySessionAction =
  | {
      type: "SESSION_INIT";
      payload: {
        sessionId: string;
        network: ZcashNetwork;
        hasViewingKey: boolean;
        createdAt?: number;
      };
    }
  | {
      type: "SESSION_SET_PHASE";
      payload: {
        phase: ZRaySessionPhase;
      };
    }
  | {
      type: "SESSION_SET_ERROR";
      payload: {
        error: ZRaySessionError | null;
      };
    }
  | {
      type: "SESSION_CLEAR";
    }
  | {
      type: "SESSION_UPDATE_NETWORK";
      payload: {
        network: ZcashNetwork | null;
      };
    }
  | {
      type: "SESSION_SET_HAS_VIEWING_KEY";
      payload: {
        hasViewingKey: boolean;
      };
    };

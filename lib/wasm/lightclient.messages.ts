// lib/wasm/lightclient.messages.ts

import type { ZcashNetwork } from "../lightwalletd/endpoints";
import type {
  LightClientSyncStatus,
  DecryptedTransaction,
  ZRayBalances,
} from "./lightclient";
import type { CompactBlock } from "../lightwalletd/client";

/**
 * Snapshot of decrypted data that is allowed to leave the worker
 * and reach the main thread through the SensitiveDataProvider.
 */
export interface DecryptedSnapshot {
  transactions: DecryptedTransaction[];
  balances: ZRayBalances | null;
}

/**
 * Supported actions for request/response pairs between main thread and worker.
 */
export type WorkerAction =
  | "init"
  | "setViewingKey"
  | "sync"
  | "getDecryptedSnapshot"
  | "clearSession"
  | "ingestBlocks";

/**
 * Base shape of any request sent from the main thread to the worker.
 * Every request is tagged with a unique requestId to correlate responses.
 */
export interface WorkerRequestBase {
  requestId: string;
  action: WorkerAction;
}

/**
 * Concrete request variants.
 */
export type WorkerRequest =
  | (WorkerRequestBase & { action: "init"; network: ZcashNetwork })
  | (WorkerRequestBase & { action: "setViewingKey"; ufvk: string })
  | (WorkerRequestBase & {
      action: "sync";
      fromHeight?: number;
    })
  | (WorkerRequestBase & { action: "getDecryptedSnapshot" })
  | (WorkerRequestBase & { action: "clearSession" })
  | (WorkerRequestBase & {
      action: "ingestBlocks";
      blocks: CompactBlock[];
      range: {
        startHeight: number;
        endHeight: number;
        tipHeight: number;
      };
    });

/**
 * Response type for successful "command" actions (no payload).
 *
 * Note: "getDecryptedSnapshot" and "ingestBlocks" return "snapshot" instead.
 */
export interface WorkerOkResponse {
  requestId: string;
  type: "ok";
  action: Exclude<WorkerAction, "getDecryptedSnapshot" | "ingestBlocks">;
}

/**
 * Response type for a decrypted snapshot.
 */
export interface WorkerSnapshotResponse {
  requestId: string;
  type: "snapshot";
  payload: DecryptedSnapshot;
}

/**
 * Push-style response with sync status updates.
 * These are not tied to a specific requestId.
 */
export interface WorkerSyncStatusResponse {
  type: "syncStatus";
  payload: LightClientSyncStatus;
}

/**
 * Push-style log message from the worker.
 */
export interface WorkerLogResponse {
  type: "log";
  message: string;
}

/**
 * Error response. When requestId is present, it is tied to a specific request.
 * Otherwise, it is a global/fatal error.
 */
export interface WorkerErrorResponse {
  type: "error";
  message: string;
  requestId?: string;
  fatal?: boolean;
}

/**
 * Union of all possible worker responses.
 */
export type WorkerResponse =
  | WorkerOkResponse
  | WorkerSnapshotResponse
  | WorkerSyncStatusResponse
  | WorkerLogResponse
  | WorkerErrorResponse;

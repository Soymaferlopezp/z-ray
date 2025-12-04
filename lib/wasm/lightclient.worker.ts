/// <reference lib="webworker" />

// lib/wasm/lightclient.worker.ts

import type { ZcashNetwork } from "../lightwalletd/endpoints";
import type {
  LightClientSyncStatus,
  DecryptedTransaction,
  ZRayBalances,
} from "./lightclient";
import type {
  WorkerRequest,
  WorkerResponse,
  DecryptedSnapshot,
} from "./lightclient.messages";
import type { CompactBlock } from "../lightwalletd/client";

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

/**
 * Internal worker state.
 *
 * NOTE: The viewing key MUST NOT be stored here in plain text.
 * The worker only tracks whether a viewing key has been configured,
 * and the actual key is passed directly to the WASM light client.
 */
interface WorkerState {
  network: ZcashNetwork | null;
  syncStatus: LightClientSyncStatus;
  wasmInitialized: boolean;
  hasViewingKey: boolean;
  decryptedTransactions: DecryptedTransaction[];
  balances: ZRayBalances | null;
  syncStartHeight?: number;
  syncTargetHeight?: number;
  // In a real implementation we will hold the WASM instance/handles here.
  // wasmClient: WasmLightClient | null;
}

/**
 * This interface documents how the WASM light client is expected to behave.
 * The actual implementation will be wired in a future hito.
 */
interface WasmLightClient {
  setViewingKey(ufvk: string): Promise<void>;
  ingestCompactBlocks(blocks: CompactBlock[]): Promise<void>;
  getDecryptedSnapshot(): Promise<{
    transactions: DecryptedTransaction[];
    balances: ZRayBalances;
  }>;
}

const state: WorkerState = {
  network: null,
  syncStatus: {
    stage: "idle",
    progress: 0,
  },
  wasmInitialized: false,
  hasViewingKey: false,
  decryptedTransactions: [],
  balances: null,
  syncStartHeight: undefined,
  syncTargetHeight: undefined,
  // wasmClient: null,
};

/**
 * TODO: Load and initialize the actual WASM module here.
 * For now this is just a placeholder so the worker API is wired.
 */
async function ensureWasmInitialized(): Promise<void> {
  if (state.wasmInitialized) return;

  // Example placeholder for future WASM integration:
  // const wasmModule = await import("/wasm/zcash_light_client.js");
  // state.wasmClient = await wasmModule.init("/wasm/zcash_light_client.wasm");

  state.wasmInitialized = true;
  postLog("WASM light client initialization placeholder executed (TODO: real implementation).");
}

/**
 * Utility: send a syncStatus snapshot to the main thread.
 */
function postSyncStatus(): void {
  const response: WorkerResponse = {
    type: "syncStatus",
    payload: state.syncStatus,
  };
  ctx.postMessage(response);
}

/**
 * Utility: post a log message to the main thread.
 */
function postLog(message: string): void {
  const response: WorkerResponse = { type: "log", message };
  ctx.postMessage(response);
}

/**
 * Utility: post an error message to the main thread.
 * When requestId is provided, the error is bound to a specific request.
 */
function postError(message: string, requestId?: string, fatal?: boolean): void {
  const response: WorkerResponse = { type: "error", message, requestId, fatal };
  ctx.postMessage(response);

  if (fatal) {
    state.syncStatus = {
      ...state.syncStatus,
      stage: "error",
      errorMessage: message,
    };
    postSyncStatus();
  }
}

/**
 * Handle "init" action.
 */
async function handleInit(requestId: string, network: ZcashNetwork): Promise<void> {
  try {
    await ensureWasmInitialized();

    state.network = network;
    state.syncStatus = {
      stage: "idle",
      progress: 0,
    };
    state.syncStartHeight = undefined;
    state.syncTargetHeight = undefined;

    postLog(`Light client worker initialized for network: ${network}.`);
    postSyncStatus();

    const response: WorkerResponse = {
      requestId,
      type: "ok",
      action: "init",
    };
    ctx.postMessage(response);
  } catch (err) {
    postError("Failed to initialize WASM light client.", requestId, true);
  }
}

/**
 * Handle "setViewingKey" action.
 *
 * IMPORTANT: The ufvk is NOT stored in the worker state.
 * It must be passed directly to the WASM light client and then discarded.
 */
async function handleSetViewingKey(requestId: string, ufvk: string): Promise<void> {
  try {
    if (!state.network) {
      postError("Cannot set viewing key before init.", requestId);
      return;
    }

    await ensureWasmInitialized();

    // TODO: pass the ufvk to the WASM light client and discard the string.
    // Example (pseudo-code):
    // await state.wasmClient?.setViewingKey(ufvk);

    // Viewing key is NOT stored in WorkerState; we only track a boolean flag.
    state.hasViewingKey = true;

    state.syncStatus = {
      stage: "idle",
      progress: 0,
      latestScannedHeight: undefined,
      latestChainHeight: undefined,
    };
    state.syncStartHeight = undefined;
    state.syncTargetHeight = undefined;

    postLog("Viewing key configured in worker (WASM call TODO).");
    postSyncStatus();

    const response: WorkerResponse = {
      requestId,
      type: "ok",
      action: "setViewingKey",
    };
    ctx.postMessage(response);
  } catch (err) {
    postError("Failed to set viewing key in WASM light client.", requestId);
  }
}

/**
 * Handle "sync" action.
 *
 * For this hito, the real scanning is driven by "ingestBlocks".
 * The "sync" action can be used as a lightweight entry point if needed.
 */
async function handleSync(requestId: string, fromHeight?: number): Promise<void> {
  try {
    if (!state.network || !state.hasViewingKey) {
      postError("Cannot sync without network and viewing key.", requestId);
      return;
    }

    await ensureWasmInitialized();

    // For now, just mark the stage as "syncing".
    state.syncStatus = {
      ...state.syncStatus,
      stage: "syncing",
    };
    postSyncStatus();

    const response: WorkerResponse = {
      requestId,
      type: "ok",
      action: "sync",
    };
    ctx.postMessage(response);
  } catch (err) {
    postError("Sync operation failed in worker.", requestId);
  }
}

/**
 * Compute progress percentage based on the current and target heights.
 */
function computeProgress(
  startHeight: number | undefined,
  latestHeight: number | undefined,
  targetHeight: number | undefined
): number {
  if (
    startHeight === undefined ||
    latestHeight === undefined ||
    targetHeight === undefined ||
    targetHeight <= startHeight
  ) {
    return 0;
  }

  const total = targetHeight - startHeight;
  const done = latestHeight - startHeight;

  if (total <= 0) return 0;

  const raw = (done / total) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Handle "ingestBlocks" action.
 *
 * This is the main integration point for real sync:
 * - compact blocks are fetched in the main thread via lightwalletdClient
 * - they are pushed to the worker in chunks
 * - the worker feeds them into the WASM client and updates:
 *   - syncStatus (progress, heights)
 *   - decryptedTransactions and balances
 */
async function handleIngestBlocks(
  requestId: string,
  blocks: CompactBlock[],
  range: {
    startHeight: number;
    endHeight: number;
    tipHeight: number;
  }
): Promise<void> {
  try {
    if (!state.network || !state.hasViewingKey) {
      postError("Cannot ingest blocks without network and viewing key.", requestId);
      return;
    }

    await ensureWasmInitialized();

    if (!state.syncStartHeight) {
      state.syncStartHeight = range.startHeight;
    }
    state.syncTargetHeight = range.tipHeight;

    // TODO: call WASM client with the compact blocks.
    // Example (pseudo-code):
    // await state.wasmClient?.ingestCompactBlocks(blocks);
    //
    // Then we would query the updated snapshot:
    // const wasmSnapshot = await state.wasmClient?.getDecryptedSnapshot();
    // state.decryptedTransactions = wasmSnapshot.transactions;
    // state.balances = wasmSnapshot.balances;

    // For now, we only update heights and progress.
    state.syncStatus.latestScannedHeight = range.endHeight;
    state.syncStatus.latestChainHeight = range.tipHeight;
    state.syncStatus.stage = "scanning";
    state.syncStatus.progress = computeProgress(
      state.syncStartHeight,
      state.syncStatus.latestScannedHeight,
      state.syncTargetHeight
    );

    if (
      state.syncStatus.latestScannedHeight !== undefined &&
      state.syncStatus.latestChainHeight !== undefined &&
      state.syncStatus.latestScannedHeight >= state.syncStatus.latestChainHeight
    ) {
      state.syncStatus.stage = "ready";
      state.syncStatus.progress = 100;
    }

    postSyncStatus();

    const snapshot: DecryptedSnapshot = {
      transactions: state.decryptedTransactions,
      balances: state.balances,
    };

    const response: WorkerResponse = {
      requestId,
      type: "snapshot",
      payload: snapshot,
    };
    ctx.postMessage(response);
  } catch (err) {
    postError("Failed to ingest compact blocks in worker.", requestId);
  }
}

/**
 * Handle "getDecryptedSnapshot" action.
 *
 * This is the ONLY way decrypted data leaves the worker.
 * The expectation is that it is consumed exclusively by the SensitiveDataProvider.
 */
function handleGetDecryptedSnapshot(requestId: string): void {
  const snapshot: DecryptedSnapshot = {
    transactions: state.decryptedTransactions,
    balances: state.balances,
  };

  const response: WorkerResponse = {
    requestId,
    type: "snapshot",
    payload: snapshot,
  };
  ctx.postMessage(response);
}

/**
 * Handle "clearSession" action.
 *
 * This clears all in-memory decrypted data and resets the logical session.
 * The WASM module may remain initialized to avoid reload overhead.
 */
function handleClearSession(requestId: string): void {
  state.hasViewingKey = false;
  state.decryptedTransactions = [];
  state.balances = null;
  state.syncStartHeight = undefined;
  state.syncTargetHeight = undefined;

  state.syncStatus = {
    stage: "idle",
    progress: 0,
  };

  postSyncStatus();
  postLog("Light client session cleared in worker.");

  const response: WorkerResponse = {
    requestId,
    type: "ok",
    action: "clearSession",
  };
  ctx.postMessage(response);
}

/**
 * Main message handler for the worker.
 */
ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  const { requestId } = request;

  switch (request.action) {
    case "init":
      await handleInit(requestId, request.network);
      break;

    case "setViewingKey":
      await handleSetViewingKey(requestId, request.ufvk);
      break;

    case "sync":
      await handleSync(requestId, request.fromHeight);
      break;

    case "ingestBlocks":
      await handleIngestBlocks(requestId, request.blocks, request.range);
      break;

    case "getDecryptedSnapshot":
      handleGetDecryptedSnapshot(requestId);
      break;

    case "clearSession":
      handleClearSession(requestId);
      break;

    default:
      postError(`Unknown worker action: ${(request as any).action}`, requestId);
  }
};

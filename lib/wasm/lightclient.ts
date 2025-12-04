// lib/wasm/lightclient.ts

import type { ZcashNetwork } from "../lightwalletd/endpoints";
import type {
  LightwalletdClient,
  CompactBlock,
} from "../lightwalletd/client";
import type {
  WorkerRequest,
  WorkerResponse,
  WorkerAction,
  DecryptedSnapshot,
} from "./lightclient.messages";

/**
 * High-level sync status exposed to the UI and state layer.
 */
export interface LightClientSyncStatus {
  stage: "idle" | "syncing" | "scanning" | "ready" | "error";
  /**
   * Overall progress for the current sync operation, from 0 to 100.
   */
  progress: number;
  /**
   * Last block height that was fully processed by the light client.
   */
  latestScannedHeight?: number;
  /**
   * Latest known chain height reported by lightwalletd.
   */
  latestChainHeight?: number;
  /**
   * Optional human-readable error message when stage === "error".
   */
  errorMessage?: string;
}

/**
 * Minimal decrypted transaction model for Z-Ray.
 * This is the shape consumed by the Explorer and Dashboard.
 */
export interface DecryptedTransaction {
  /**
   * Transaction ID as hex string.
   */
  txId: string;
  /**
   * Block height where this transaction was confirmed.
   */
  height: number;
  /**
   * Optional timestamp (epoch seconds) derived from the block time.
   */
  timestamp?: number;
  /**
   * Net amount, in ZEC units, relevant to the current viewing key.
   * Positive for incoming, negative for outgoing. For "self" it can be zero.
   */
  amount: number;
  /**
   * Logical direction of the transaction from the user's perspective.
   */
  direction: "incoming" | "outgoing" | "self";
  /**
   * Optional memo text (already decoded to UTF-8), if available.
   */
  memo?: string;
}

/**
 * High-level balance summary for the current viewing key.
 * For the MVP we keep it simple: confirmed and unconfirmed totals.
 */
export interface ZRayBalances {
  /**
   * Confirmed balance (funds in fully confirmed notes), in ZEC units.
   */
  confirmed: number;
  /**
   * Unconfirmed or pending balance (e.g. recent transactions), in ZEC units.
   */
  unconfirmed: number;
}

/**
 * Options required to create a high-level light client instance.
 * The instance is bound to a specific Zcash network and uses the
 * provided LightwalletdClient for block/network access.
 */
export interface ZRayLightClientOptions {
  network: ZcashNetwork;
  lightwalletdClient: LightwalletdClient;
}

/**
 * Public interface exposed by the WASM-backed light client bridge.
 * This is what the UI and state layer will interact with.
 *
 * Internally, calls will be delegated to a Web Worker that wraps
 * the actual WASM light client implementation.
 */
export interface ZRayLightClient {
  /**
   * Initialize the underlying WASM runtime and internal state
   * for the configured Zcash network.
   *
   * Must be called in a browser (client) environment.
   */
  init(): Promise<void>;

  /**
   * Set the unified viewing key for the current session.
   * This must be called before any sync/scan operation.
   *
   * The viewing key MUST NOT be persisted or sent to any server.
   * It should only live inside the worker/WASM memory.
   */
  setViewingKey(params: { ufvk: string }): Promise<void>;

  /**
   * Perform a full sync + scan operation.
   *
   * This implementation:
   * - determines the chain tip via lightwalletd
   * - decides a starting height (fromHeight or lookback)
   * - fetches CompactBlocks in chunks
   * - streams them into the worker via "ingestBlocks"
   */
  fullSync(params?: { fromHeight?: number }): Promise<void>;

  /**
   * Backwards-compatible alias for fullSync().
   */
  sync(params?: { fromHeight?: number }): Promise<void>;

  /**
   * Retrieve the latest sync status snapshot, including
   * progress, heights and error information.
   */
  getSyncStatus(): Promise<LightClientSyncStatus>;

  /**
   * Retrieve a snapshot of decrypted data: transactions and balances.
   *
   * This is intended to be consumed exclusively by the SensitiveDataProvider.
   */
  getDecryptedSnapshot(): Promise<DecryptedSnapshot>;

  /**
   * Backwards-compatible helper: returns decrypted transactions only.
   */
  getDecryptedTransactions(): Promise<DecryptedTransaction[]>;

  /**
   * Backwards-compatible helper: returns balances only.
   */
  getBalances(): Promise<ZRayBalances>;

  /**
   * Clear any in-memory session state, including decrypted data.
   * This also terminates the underlying worker instance.
   */
  clearSession(): Promise<void>;
}

/**
 * Type signature for the factory function that creates a ZRayLightClient.
 */
export type CreateZRayLightClient = (
  options: ZRayLightClientOptions
) => ZRayLightClient;

interface PendingRequest {
  resolve: (msg: WorkerResponse) => void;
  reject: (err: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

/**
 * Default sync parameters.
 *
 * For the MVP we only look back a bounded number of blocks to avoid
 * huge initial scans when the user does not provide a specific birthday.
 */
const DEFAULT_LOOKBACK_BLOCKS = 100_000;
const SYNC_CHUNK_SIZE = 5_000;
const MAX_RETRIES_PER_CHUNK = 3;

/**
 * Generate a simple unique requestId.
 * In modern browsers we can use crypto.randomUUID(), otherwise fallback.
 */
function generateRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Concrete implementation of the ZRayLightClient factory.
 *
 * This creates a dedicated Web Worker that hosts the WASM light client
 * and returns a thin proxy object that delegates all operations to it.
 *
 * IMPORTANT: this function must only be called from client-side code
 * (e.g. inside a React Client Component or a custom hook).
 */
export const createZRayLightClient: CreateZRayLightClient = (options) => {
  if (typeof window === "undefined") {
    throw new Error(
      "createZRayLightClient must be called in a browser (client) environment."
    );
  }

  const { network, lightwalletdClient } = options;

  const worker = new Worker(new URL("./lightclient.worker.ts", import.meta.url), {
    type: "module",
  });

  let initialized = false;
  let viewingKeySet = false;
  let destroyed = false;

  let lastSyncStatus: LightClientSyncStatus = {
    stage: "idle",
    progress: 0,
  };

  const pendingRequests = new Map<string, PendingRequest>();

  function assertNotDestroyed(): void {
    if (destroyed) {
      throw new Error("ZRayLightClient instance has been destroyed.");
    }
  }

  /**
   * Low-level send: post a WorkerRequest and register a pending entry.
   */
  function sendRequest(action: WorkerAction, payload: Partial<WorkerRequest>): string {
    assertNotDestroyed();

    const requestId = generateRequestId();

    const request: WorkerRequest = {
      requestId,
      action,
      ...(payload as any),
    };

    worker.postMessage(request);
    return requestId;
  }

  /**
   * High-level helper: send a request and wait for a response
   * of a specific type (e.g. "ok", "snapshot"), with a timeout.
   */
  function sendRequestAndWait(
    action: WorkerAction,
    payload: Partial<WorkerRequest>,
    expectedType: WorkerResponse["type"],
    timeoutMs = 30000
  ): Promise<WorkerResponse> {
    const requestId = sendRequest(action, payload);

    return new Promise<WorkerResponse>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error(`Worker request '${action}' timed out.`));
      }, timeoutMs);

      pendingRequests.set(requestId, { resolve, reject, timeoutId });
    }).then((msg) => {
      if (msg.type === "error") {
        throw new Error(msg.message);
      }
      if (msg.type !== expectedType) {
        throw new Error(
          `Unexpected worker response type '${msg.type}' for action '${action}'.`
        );
      }
      return msg;
    });
  }

  /**
   * Global message handler: route responses, maintain sync status,
   * and deliver logs/errors.
   */
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;

    if (message.type === "syncStatus") {
      lastSyncStatus = message.payload;
      return;
    }

    if (message.type === "log") {
      // eslint-disable-next-line no-console
      console.debug("[zray-lightclient][worker]", message.message);
      return;
    }

    if (message.type === "error" && !message.requestId) {
      // Global/fatal error not tied to a specific request.
      // eslint-disable-next-line no-console
      console.error("[zray-lightclient][worker]", message.message);
      lastSyncStatus = {
        ...lastSyncStatus,
        stage: "error",
        errorMessage: message.message,
      };
      return;
    }

    if (!("requestId" in message) || !message.requestId) {
      // eslint-disable-next-line no-console
      console.warn(
        "[zray-lightclient][worker] Received message without requestId:",
        message
      );
      return;
    }

    const pending = pendingRequests.get(message.requestId);
    if (!pending) {
      // eslint-disable-next-line no-console
      console.warn(
        "[zray-lightclient][worker] No pending request for response:",
        message
      );
      return;
    }

    pendingRequests.delete(message.requestId);
    clearTimeout(pending.timeoutId);

    if (message.type === "error") {
      pending.reject(new Error(message.message));
    } else {
      pending.resolve(message);
    }
  };

  /**
   * Destroy the worker and reject all pending requests.
   */
  function destroyWorker(): void {
    if (destroyed) return;
    destroyed = true;

    worker.terminate();

    for (const [requestId, pending] of pendingRequests.entries()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error("Worker terminated."));
      pendingRequests.delete(requestId);
    }
  }

  // Optional: clean up worker when the window is unloading.
  if (typeof window !== "undefined" && "addEventListener" in window) {
    window.addEventListener("beforeunload", () => {
      destroyWorker();
    });
  }

  async function fetchBlocksWithRetries(
    start: number,
    end: number
  ): Promise<CompactBlock[]> {
    let attempt = 0;
    // simple retry loop
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await lightwalletdClient.getCompactBlocks(start, end);
      } catch (err) {
        attempt += 1;
        if (attempt >= MAX_RETRIES_PER_CHUNK) {
          throw new Error(
            `Failed to fetch compact blocks for range [${start}, ${end}] after ${MAX_RETRIES_PER_CHUNK} attempts.`
          );
        }
        // Backoff could be added here if needed.
      }
    }
  }

  const client: ZRayLightClient = {
    async init(): Promise<void> {
      assertNotDestroyed();

      if (initialized) return;

      await sendRequestAndWait("init", { network }, "ok");

      initialized = true;
    },

    async setViewingKey(params: { ufvk: string }): Promise<void> {
      assertNotDestroyed();

      if (!initialized) {
        throw new Error(
          "ZRayLightClient must be initialized before setting a viewing key."
        );
      }

      // IMPORTANT: ufvk is only passed to the worker.
      // It is not stored in this bridge or in any global state.
      await sendRequestAndWait("setViewingKey", { ufvk: params.ufvk }, "ok");

      viewingKeySet = true;
    },

    async fullSync(params?: { fromHeight?: number }): Promise<void> {
      assertNotDestroyed();

      if (!initialized) {
        throw new Error("ZRayLightClient must be initialized before syncing.");
      }
      if (!viewingKeySet) {
        throw new Error(
          "ZRayLightClient requires a viewing key before syncing."
        );
      }

      // 1) Discover chain tip
      const tipHeight = await lightwalletdClient.getLatestBlockHeight();
      if (!Number.isFinite(tipHeight) || tipHeight < 0) {
        throw new Error("Invalid latest block height returned by lightwalletd.");
      }

      // 2) Determine starting height
      const explicitFrom = params?.fromHeight;
      const fromHeight =
        typeof explicitFrom === "number" && explicitFrom >= 0
          ? explicitFrom
          : Math.max(0, tipHeight - DEFAULT_LOOKBACK_BLOCKS);

      if (fromHeight > tipHeight) {
        // Nothing to sync, just mark as ready.
        lastSyncStatus = {
          stage: "ready",
          progress: 100,
          latestScannedHeight: tipHeight,
          latestChainHeight: tipHeight,
        };
        return;
      }

      // Optionally notify the worker that a sync is starting.
      await sendRequestAndWait("sync", { fromHeight }, "ok");

      let currentStart = fromHeight;

      while (currentStart <= tipHeight) {
        const currentEnd = Math.min(currentStart + SYNC_CHUNK_SIZE - 1, tipHeight);

        const blocks: CompactBlock[] = await fetchBlocksWithRetries(
          currentStart,
          currentEnd
        );

        if (blocks.length > 0) {
          await sendRequestAndWait(
            "ingestBlocks",
            {
              blocks,
              range: {
                startHeight: currentStart,
                endHeight: currentEnd,
                tipHeight,
              },
            } as any,
            "snapshot"
          );
          // syncStatus is being updated by the worker via push messages.
        }

        currentStart = currentEnd + 1;
      }

      // Ensure we end in "ready" even if the worker did not push the final state.
      lastSyncStatus = {
        ...lastSyncStatus,
        stage: "ready",
        latestScannedHeight: tipHeight,
        latestChainHeight: tipHeight,
        progress: 100,
      };
    },

    async sync(params?: { fromHeight?: number }): Promise<void> {
      // Backwards-compatible alias for fullSync().
      return this.fullSync(params);
    },

    async getSyncStatus(): Promise<LightClientSyncStatus> {
      assertNotDestroyed();
      return lastSyncStatus;
    },

    async getDecryptedSnapshot(): Promise<DecryptedSnapshot> {
      assertNotDestroyed();

      if (!initialized || !viewingKeySet) {
        return {
          transactions: [],
          balances: null,
        };
      }

      const msg = await sendRequestAndWait(
        "getDecryptedSnapshot",
        {},
        "snapshot"
      );

      return (msg as any).payload as DecryptedSnapshot;
    },

    async getDecryptedTransactions(): Promise<DecryptedTransaction[]> {
      const snapshot = await this.getDecryptedSnapshot();
      return snapshot.transactions;
    },

    async getBalances(): Promise<ZRayBalances> {
      const snapshot = await this.getDecryptedSnapshot();
      return (
        snapshot.balances ?? {
          confirmed: 0,
          unconfirmed: 0,
        }
      );
    },

    async clearSession(): Promise<void> {
      assertNotDestroyed();

      await sendRequestAndWait("clearSession", {}, "ok");

      viewingKeySet = false;
      lastSyncStatus = {
        stage: "idle",
        progress: 0,
      };

      destroyWorker();
    },
  };

  return client;
};

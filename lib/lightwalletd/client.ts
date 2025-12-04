// lib/lightwalletd/client.ts

import {
  LightwalletdEndpoint,
  ZcashNetwork,
  getEndpointsByNetwork,
} from "./endpoints";

// Basic metadata returned by lightwalletd or our gateway.
export interface LightdInfo {
  chainName: string;
  blockHeight: number;
  vendor?: string;
}

// Minimal compact block representation used by Z-Ray.
export interface CompactBlock {
  height: number;
  hashHex?: string;
  // Real implementation will likely include more fields (raw bytes, etc.).
}

// Public client interface consumed by the rest of the app.
export interface LightwalletdClient {
  getActiveEndpoint(): LightwalletdEndpoint | null;

  getLightdInfo(): Promise<LightdInfo>;

  getLatestBlockHeight(): Promise<number>;

  getCompactBlocks(
    startHeight: number,
    endHeight: number
  ): Promise<CompactBlock[]>;

  getTransaction?(txIdHex: string): Promise<Uint8Array | null>;
}

// Factory function used by other modules.
export function createLightwalletdClient(options: {
  network: ZcashNetwork;
}): LightwalletdClient {
  const { network } = options;

  const endpoints = getEndpointsByNetwork(network);

  if (endpoints.length === 0) {
    throw new Error(`No lightwalletd endpoints configured for network: ${network}`);
  }

  const state = createLightwalletdState(endpoints);

  return createLightwalletdClientImpl(state);
}

// Internal runtime state for endpoints + active selection.

interface EndpointRuntimeState {
  endpoint: LightwalletdEndpoint;
  healthy: boolean;
  lastError?: string;
  lastLatencyMs?: number;
  lastBlockHeight?: number;
}

interface LightwalletdState {
  endpoints: EndpointRuntimeState[];
  activeEndpoint: EndpointRuntimeState | null;
}

function createLightwalletdState(
  endpoints: LightwalletdEndpoint[]
): LightwalletdState {
  return {
    endpoints: endpoints.map((endpoint) => ({
      endpoint,
      healthy: false,
    })),
    activeEndpoint: null,
  };
}

// Dev-only logging helper for lightwalletd events.
// IMPORTANT: This logger must never receive sensitive data such as viewing keys,
// user addresses, decrypted notes, etc.

export type LightwalletdLogEventType = "healthcheck" | "request" | "failover";

export interface LightwalletdLogEvent {
  endpointId: string;
  type: LightwalletdLogEventType;
  message: string;
}

export function logLightwalletdEvent(event: LightwalletdLogEvent) {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    // In production we keep this silent for now.
    return;
  }

  // eslint-disable-next-line no-console
  console.debug("[lightwalletd]", event);
}

// Mock mode for frontend-only development.
const MOCK_MODE =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_ZRAY_MOCK_LIGHTWALLETD === "1";

// Small fetch helper with timeout support.

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 8000, ...rest } = init;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(input, {
      ...rest,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Build the proxy URL for a given operation.
 * The browser talks to /api/lightwalletd (same origin, no CORS issues),
 * and the route handler forwards the request to the actual lightwalletd endpoint.
 */
function buildProxyUrl(params: Record<string, string>): string {
  const qs = new URLSearchParams(params);
  return `/api/lightwalletd?${qs.toString()}`;
}

// --- Transport layer (via proxy or mock) ---

async function fetchLightdInfo(
  endpoint: LightwalletdEndpoint,
  options: { timeoutMs?: number } = {}
): Promise<LightdInfo> {
  if (MOCK_MODE) {
    return {
      chainName: endpoint.network === "mainnet" ? "main" : "test",
      blockHeight: 1_234_567,
      vendor: "mock-lightwalletd",
    };
  }

  const url = buildProxyUrl({
    endpointId: endpoint.id,
    op: "getlightdinfo",
  });

  const res = await fetchWithTimeout(url, {
    method: "GET",
    timeoutMs: options.timeoutMs ?? 5000,
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch lightd info (status ${res.status})`);
  }

  const json = (await res.json()) as any;

  return {
    chainName: json.chainName ?? json.chain_name ?? "unknown",
    blockHeight: json.blockHeight ?? json.block_height ?? 0,
    vendor: json.vendor,
  };
}

async function fetchCompactBlockRange(
  endpoint: LightwalletdEndpoint,
  startHeight: number,
  endHeight: number
): Promise<CompactBlock[]> {
  if (MOCK_MODE) {
    const blocks: CompactBlock[] = [];
    for (let h = startHeight; h <= endHeight; h++) {
      blocks.push({
        height: h,
        hashHex: `mock-hash-${h}`,
      });
    }
    return blocks;
  }

  const url = buildProxyUrl({
    endpointId: endpoint.id,
    op: "getcompactblocks",
    start: String(startHeight),
    end: String(endHeight),
  });

  const res = await fetchWithTimeout(url, {
    method: "GET",
    timeoutMs: 15000,
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch compact blocks (status ${res.status})`);
  }

  const json = (await res.json()) as any[];

  return json.map((item) => ({
    height: item.height,
    hashHex: item.hashHex ?? item.hash_hex,
  }));
}

async function fetchTransaction(
  endpoint: LightwalletdEndpoint,
  txIdHex: string
): Promise<Uint8Array | null> {
  if (MOCK_MODE) {
    return null;
  }

  const url = buildProxyUrl({
    endpointId: endpoint.id,
    op: "gettransaction",
    txid: txIdHex,
  });

  const res = await fetchWithTimeout(url, {
    method: "GET",
    timeoutMs: 10000,
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch transaction (status ${res.status})`);
  }

  const json = (await res.json()) as any;

  if (typeof json.rawHex === "string") {
    return hexToBytes(json.rawHex);
  }

  if (typeof json.rawBase64 === "string") {
    return base64ToBytes(json.rawBase64);
  }

  return null;
}

// Tiny utils for encoding conversions.

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const len = clean.length / 2;
  const out = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }

  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob !== "undefined") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }

  // Node.js fallback
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(b64, "base64"));
  }

  throw new Error("No base64 decoder available");
}

// --- Endpoint selection & healthcheck ---

async function selectBestEndpoint(
  state: LightwalletdState,
  timeoutMs: number = 5000
): Promise<EndpointRuntimeState> {
  const healthcheckPromises = state.endpoints.map(async (entry) => {
    const startedAt = performance.now();

    try {
      const info = await fetchLightdInfo(entry.endpoint, { timeoutMs });
      const latency = performance.now() - startedAt;

      entry.healthy = true;
      entry.lastLatencyMs = latency;
      entry.lastBlockHeight = info.blockHeight;
      entry.lastError = undefined;

      logLightwalletdEvent({
        endpointId: entry.endpoint.id,
        type: "healthcheck",
        message: `ok latency=${latency.toFixed(0)}ms height=${info.blockHeight}`,
      });

      return entry;
    } catch (err: any) {
      entry.healthy = false;
      entry.lastError = err?.message ?? "healthcheck failed";

      logLightwalletdEvent({
        endpointId: entry.endpoint.id,
        type: "healthcheck",
        message: `error=${entry.lastError}`,
      });

      return entry;
    }
  });

  await Promise.allSettled(healthcheckPromises);

  const healthy = state.endpoints.filter((entry) => entry.healthy);

  if (healthy.length === 0) {
    throw new Error("No healthy lightwalletd endpoints available");
  }

  healthy.sort((a, b) => {
    const aPrimary = a.endpoint.primary ? 1 : 0;
    const bPrimary = b.endpoint.primary ? 1 : 0;

    if (aPrimary !== bPrimary) {
      return bPrimary - aPrimary; // primary first
    }

    const aLat = a.lastLatencyMs ?? Number.POSITIVE_INFINITY;
    const bLat = b.lastLatencyMs ?? Number.POSITIVE_INFINITY;

    return aLat - bLat; // lower latency first
  });

  const selected = healthy[0];
  state.activeEndpoint = selected;

  logLightwalletdEvent({
    endpointId: selected.endpoint.id,
    type: "failover",
    message: "selected as active endpoint",
  });

  return selected;
}

async function withFailover<T>(
  state: LightwalletdState,
  fn: (endpoint: LightwalletdEndpoint) => Promise<T>,
  options: { timeoutMs?: number } = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 8000;

  if (!state.activeEndpoint) {
    await selectBestEndpoint(state, timeoutMs);
  }

  const tried = new Set<string>();

  while (true) {
    const current = state.activeEndpoint;

    if (!current) {
      throw new Error("No active lightwalletd endpoint available");
    }

    tried.add(current.endpoint.id);

    try {
      const result = await fn(current.endpoint);
      return result;
    } catch (err: any) {
      current.healthy = false;
      current.lastError = err?.message ?? "request failed";

      logLightwalletdEvent({
        endpointId: current.endpoint.id,
        type: "request",
        message: `request failed: ${current.lastError}`,
      });

      const healthyCandidates = state.endpoints.filter(
        (entry) => entry.healthy && !tried.has(entry.endpoint.id)
      );

      if (healthyCandidates.length === 0) {
        // Re-run selection globally to see if any endpoint recovers.
        try {
          await selectBestEndpoint(state, timeoutMs);
        } catch {
          // Nothing else to try.
          throw err;
        }
      } else {
        state.activeEndpoint = healthyCandidates[0];

        logLightwalletdEvent({
          endpointId: state.activeEndpoint.endpoint.id,
          type: "failover",
          message: "switched to backup endpoint",
        });
      }

      if (tried.size >= state.endpoints.length) {
        // Safety: avoid infinite loops when all endpoints are failing.
        throw err;
      }
    }
  }
}

function createLightwalletdClientImpl(
  state: LightwalletdState
): LightwalletdClient {
  return {
    getActiveEndpoint() {
      return state.activeEndpoint?.endpoint ?? null;
    },

    async getLightdInfo(): Promise<LightdInfo> {
      return withFailover(state, (endpoint) => fetchLightdInfo(endpoint));
    },

    async getLatestBlockHeight(): Promise<number> {
      const info = await withFailover(state, (endpoint) => fetchLightdInfo(endpoint));
      return info.blockHeight;
    },

    async getCompactBlocks(
      startHeight: number,
      endHeight: number
    ): Promise<CompactBlock[]> {
      if (endHeight < startHeight) {
        throw new Error("endHeight must be >= startHeight");
      }

      return withFailover(state, (endpoint) =>
        fetchCompactBlockRange(endpoint, startHeight, endHeight)
      );
    },

    async getTransaction(txIdHex: string): Promise<Uint8Array | null> {
      return withFailover(state, (endpoint) => fetchTransaction(endpoint, txIdHex));
    },
  };
}

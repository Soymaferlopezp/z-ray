// lib/config/network-types.ts

/**
 * Supported Zcash networks for Z-Ray.
 *
 * These values are safe to persist in UI settings, because they contain
 * no sensitive information and are purely public configuration options.
 */
export type ZcashNetwork = "mainnet" | "testnet";

export const ZCASH_NETWORKS: ZcashNetwork[] = ["mainnet", "testnet"];

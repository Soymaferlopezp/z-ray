// types/zcash_light_client.d.ts

/**
 * Minimal module declaration for the Zcash WASM light client glue.
 *
 * This is a stub so that TypeScript does not complain about:
 *   import "/wasm/zcash_light_client.js"
 *
 * The real implementation will be provided by the WASM engineer.
 */
declare module "/wasm/zcash_light_client.js" {
  // You can tighten this later when the real API is known.
  export async function initZcashLightClient(
    wasmUrl: string,
    options: { network: string }
  ): Promise<{
    setViewingKey(ufvk: string): Promise<void>;
    ingestCompactBlocks(blocks: any[]): Promise<void>;
    getDecryptedSnapshot(): Promise<{
      transactions: any[];
      balances: any;
    }>;
  }>;
}

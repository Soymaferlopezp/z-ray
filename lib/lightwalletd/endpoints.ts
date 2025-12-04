export type ZcashNetwork = "mainnet" | "testnet";

export type LightwalletdRegion = "na" | "eu" | "sa" | "asia";

export interface LightwalletdEndpoint {
  id: string;
  url: string;
  network: ZcashNetwork;
  region?: LightwalletdRegion;
  primary?: boolean;
}

/**
 * Static list of public lightwalletd endpoints.
 * These are used as candidates for healthcheck + selection.
 */
export const LIGHTWALLETD_ENDPOINTS: LightwalletdEndpoint[] = [
  // --- Mainnet: Zec.rocks cluster ---
  {
    id: "zecrocks-core",
    url: "https://zec.rocks:443",
    network: "mainnet",
    region: "eu",
    primary: true,
  },
  {
    id: "zecrocks-na",
    url: "https://na.zec.rocks:443",
    network: "mainnet",
    region: "na",
    primary: true,
  },
  {
    id: "zecrocks-eu",
    url: "https://eu.zec.rocks:443",
    network: "mainnet",
    region: "eu",
  },
  {
    id: "zecrocks-sa",
    url: "https://sa.zec.rocks:443",
    network: "mainnet",
    region: "sa",
  },

  // --- Mainnet: other community endpoints ---
  {
    id: "netstable-main",
    url: "https://lightwallet.netstable.stream:9067",
    network: "mainnet",
    region: "na",
  },
  {
    id: "miscthings-main",
    url: "https://z.miscthings.casa:443",
    network: "mainnet",
    region: "eu",
  },
  {
    id: "mysideoftheweb-main",
    url: "https://zcash.mysideoftheweb.com:9067",
    network: "mainnet",
    region: "na",
  },

  // --- Testnet ---
  {
    id: "zecrocks-testnet",
    url: "https://testnet.zec.rocks:443",
    network: "testnet",
    region: "eu",
    primary: true,
  },
  {
    id: "mysideoftheweb-testnet",
    url: "https://zcash.mysideoftheweb.com:19067",
    network: "testnet",
    region: "na",
  },
];

/**
 * Returns all endpoints configured for a given Zcash network.
 */
export function getEndpointsByNetwork(
  network: ZcashNetwork
): LightwalletdEndpoint[] {
  return LIGHTWALLETD_ENDPOINTS.filter((endpoint) => endpoint.network === network);
}

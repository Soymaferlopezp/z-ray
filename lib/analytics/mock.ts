import { DecryptedTransaction } from "./types";

/**
 * Simple helper to generate mock transactions for the dashboard
 * when the WASM light client still does not return real data.
 *
 * This MUST only be used behind a dev/test flag.
 */

function randomElement<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const MOCK_DIRECTIONS = ["incoming", "outgoing"] as const;

/**
 * Generate `count` pseudo-random transactions over the last 30 days.
 * Shape matches the real DecryptedTransaction type from the light client.
 */
export function generateMockTransactions(
  count: number
): DecryptedTransaction[] {
  const now = Math.floor(Date.now() / 1000);
  const oneDay = 24 * 60 * 60;

  const txs: DecryptedTransaction[] = [];

  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const timestamp = now - daysAgo * oneDay;

    const direction = randomElement(MOCK_DIRECTIONS);

    // For mocks we keep incoming positive, outgoing negative.
    const rawAmount = Math.random() * 0.5 + 0.01;
    const amount =
      direction === "incoming" ? rawAmount : -rawAmount;

    const tx: DecryptedTransaction = {
      txId: `mock-${i}`,
      height: 1_000_000 + i,
      timestamp,
      amount,
      direction,
      memo: undefined,
    };

    txs.push(tx);
  }

  return txs;
}

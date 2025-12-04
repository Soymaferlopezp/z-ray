import {
  ActivityByDayOfWeek,
  AggregateStats,
  DashboardData,
  DashboardFilters,
  DecryptedTransaction,
  Granularity,
  TimeSeriesPoint,
  ZRayBalances,
} from "./types";

/**
 * Narrow DecryptedTransaction to only those that have a numeric timestamp.
 */
type DatedTransaction = DecryptedTransaction & { timestamp: number };

function filterDatedTransactions(
  txs: DecryptedTransaction[]
): DatedTransaction[] {
  return txs.filter(
    (tx): tx is DatedTransaction => typeof tx.timestamp === "number"
  );
}

/**
 * Internal helper: apply basic filters (time range, direction).
 *
 * NOTE:
 * - If a time range filter is provided and a tx has no timestamp,
 *   that tx is excluded from the result.
 */
function applyFilters(
  txs: DecryptedTransaction[],
  filters: DashboardFilters
): DecryptedTransaction[] {
  const { fromTimestamp, toTimestamp, direction = "all" } = filters;

  const hasTimeFilter =
    typeof fromTimestamp === "number" || typeof toTimestamp === "number";

  return txs.filter((tx) => {
    // Time range
    if (hasTimeFilter) {
      if (typeof tx.timestamp !== "number") {
        // No timestamp, cannot place it in the range → drop it.
        return false;
      }
      if (fromTimestamp != null && tx.timestamp < fromTimestamp) return false;
      if (toTimestamp != null && tx.timestamp > toTimestamp) return false;
    }

    // Direction
    if (direction !== "all" && tx.direction !== direction) return false;

    return true;
  });
}

/**
 * Aggregate KPIs for the current filtered set of transactions.
 *
 * amount semantics:
 * - Positive for incoming
 * - Negative for outgoing
 * - Zero for self
 */
export function computeAggregateStats(
  txs: DecryptedTransaction[]
): AggregateStats {
  if (txs.length === 0) {
    return {
      totalReceived: 0,
      totalSent: 0,
      netFlow: 0,
      txCount: 0,
      averageTxAmount: null,
    };
  }

  let totalReceived = 0;
  let totalSent = 0;
  let sumAbsAmounts = 0;

  for (const tx of txs) {
    const amt = tx.amount;

    // Absolute amount for averages
    sumAbsAmounts += Math.abs(amt);

    if (tx.direction === "incoming") {
      // should already be positive, but we guard just in case
      totalReceived += amt > 0 ? amt : Math.abs(amt);
    } else if (tx.direction === "outgoing") {
      totalSent += amt < 0 ? Math.abs(amt) : amt;
    }
  }

  const txCount = txs.length;
  const averageTxAmount = txCount > 0 ? sumAbsAmounts / txCount : null;

  return {
    totalReceived,
    totalSent,
    netFlow: totalReceived - totalSent,
    txCount,
    averageTxAmount,
  };
}

/**
 * Normalize a timestamp to the start of the corresponding bucket (day/week/month).
 */
function normalizeToBucketStart(
  timestamp: number,
  granularity: Granularity
): number {
  const d = new Date(timestamp * 1000);

  if (granularity === "day") {
    d.setUTCHours(0, 0, 0, 0);
  } else if (granularity === "week") {
    const day = d.getUTCDay(); // 0–6, Sunday = 0
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
  } else if (granularity === "month") {
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
  }

  return Math.floor(d.getTime() / 1000);
}

/**
 * Group items by bucket.
 */
function groupByBucket<T extends { timestamp: number }>(
  items: T[],
  granularity: Granularity
): Map<number, T[]> {
  const buckets = new Map<number, T[]>();

  for (const item of items) {
    const bucketTs = normalizeToBucketStart(item.timestamp, granularity);
    const arr = buckets.get(bucketTs) ?? [];
    arr.push(item);
    buckets.set(bucketTs, arr);
  }

  return buckets;
}

/**
 * Balance over time (running balance per bucket).
 *
 * NOTE:
 *  - For now we assume initialBalance = 0.
 *  - Later we can inject a real initial balance from the light client.
 */
export function computeBalanceOverTime(
  txs: DecryptedTransaction[],
  granularity: Granularity,
  initialBalance: number = 0
): TimeSeriesPoint[] {
  const dated = filterDatedTransactions(txs);
  if (dated.length === 0) return [];

  const sorted = [...dated].sort(
    (a, b) => a.timestamp - b.timestamp
  );
  const buckets = groupByBucket(sorted, granularity);
  const bucketKeys = Array.from(buckets.keys()).sort((a, b) => a - b);

  let balance = initialBalance;
  const result: TimeSeriesPoint[] = [];

  for (const bucketTs of bucketKeys) {
    const bucketTxs = buckets.get(bucketTs)!;

    for (const tx of bucketTxs) {
      if (tx.direction === "incoming") {
        balance += tx.amount > 0 ? tx.amount : Math.abs(tx.amount);
      } else if (tx.direction === "outgoing") {
        balance -= tx.amount < 0 ? Math.abs(tx.amount) : tx.amount;
      }
    }

    result.push({
      timestamp: bucketTs,
      value: balance,
    });
  }

  return result;
}

/**
 * Incoming / outgoing / net volume per bucket.
 */
export function computeVolumeOverTime(
  txs: DecryptedTransaction[],
  granularity: Granularity
): {
  incoming: TimeSeriesPoint[];
  outgoing: TimeSeriesPoint[];
  netFlow: TimeSeriesPoint[];
} {
  const dated = filterDatedTransactions(txs);
  if (dated.length === 0) {
    return {
      incoming: [],
      outgoing: [],
      netFlow: [],
    };
  }

  const sorted = [...dated].sort(
    (a, b) => a.timestamp - b.timestamp
  );
  const buckets = groupByBucket(sorted, granularity);
  const bucketKeys = Array.from(buckets.keys()).sort((a, b) => a - b);

  const incoming: TimeSeriesPoint[] = [];
  const outgoing: TimeSeriesPoint[] = [];
  const netFlow: TimeSeriesPoint[] = [];

  for (const bucketTs of bucketKeys) {
    const bucketTxs = buckets.get(bucketTs)!;

    let inc = 0;
    let out = 0;

    for (const tx of bucketTxs) {
      if (tx.direction === "incoming") {
        inc += tx.amount > 0 ? tx.amount : Math.abs(tx.amount);
      } else if (tx.direction === "outgoing") {
        out += tx.amount < 0 ? Math.abs(tx.amount) : tx.amount;
      }
    }

    incoming.push({ timestamp: bucketTs, value: inc });
    outgoing.push({ timestamp: bucketTs, value: out });
    netFlow.push({ timestamp: bucketTs, value: inc - out });
  }

  return { incoming, outgoing, netFlow };
}

/**
 * Transaction count per bucket.
 */
export function computeTxCountOverTime(
  txs: DecryptedTransaction[],
  granularity: Granularity
): TimeSeriesPoint[] {
  const dated = filterDatedTransactions(txs);
  if (dated.length === 0) return [];

  const sorted = [...dated].sort(
    (a, b) => a.timestamp - b.timestamp
  );
  const buckets = groupByBucket(sorted, granularity);
  const bucketKeys = Array.from(buckets.keys()).sort((a, b) => a - b);

  const result: TimeSeriesPoint[] = [];

  for (const bucketTs of bucketKeys) {
    const bucketTxs = buckets.get(bucketTs)!;
    result.push({ timestamp: bucketTs, value: bucketTxs.length });
  }

  return result;
}

/**
 * Activity by day of week (0–6, Sunday–Saturday).
 */
export function computeActivityByDayOfWeek(
  txs: DecryptedTransaction[]
): ActivityByDayOfWeek {
  const dated = filterDatedTransactions(txs);
  const result: ActivityByDayOfWeek = {};

  for (const tx of dated) {
    const d = new Date(tx.timestamp * 1000);
    const weekday = d.getUTCDay();

    if (!result[weekday]) {
      result[weekday] = {
        txCount: 0,
        volumeReceived: 0,
        volumeSent: 0,
      };
    }

    const stats = result[weekday];
    stats.txCount += 1;

    if (tx.direction === "incoming") {
      stats.volumeReceived += tx.amount > 0 ? tx.amount : Math.abs(tx.amount);
    } else if (tx.direction === "outgoing") {
      stats.volumeSent += tx.amount < 0 ? Math.abs(tx.amount) : tx.amount;
    }
  }

  return result;
}

/**
 * High-level entrypoint: compute all dashboard data from
 * decrypted transactions + balances + filters.
 *
 * For now, balances are not used directly in the charts, but the
 * type is part of the contract so we can evolve this later.
 */
export function computeDashboardData(
  txs: DecryptedTransaction[],
  balances: ZRayBalances | null,
  filters: DashboardFilters
): DashboardData {
  const granularity = filters.granularity ?? "day";

  const filtered = applyFilters(txs, filters);
  const stats = computeAggregateStats(filtered);
  const balanceOverTime = computeBalanceOverTime(filtered, granularity, 0);
  const volumeOverTime = computeVolumeOverTime(filtered, granularity);
  const txCountOverTime = computeTxCountOverTime(filtered, granularity);
  const activityByDayOfWeek = computeActivityByDayOfWeek(filtered);

  void balances; // reserved for future use

  return {
    stats,
    balanceOverTime,
    volumeOverTime,
    txCountOverTime,
    activityByDayOfWeek,
  };
}

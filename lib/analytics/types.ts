// lib/analytics/types.ts

import type {
  DecryptedTransaction as LightClientDecryptedTransaction,
  ZRayBalances as LightClientZRayBalances,
} from "../wasm/lightclient";

// We alias the WASM types to avoid divergence.
// Analytics must NOT redefine these shapes.

export type DecryptedTransaction = LightClientDecryptedTransaction;
export type ZRayBalances = LightClientZRayBalances;

export type Direction = "incoming" | "outgoing" | "self";
export type DirectionFilter = "all" | "incoming" | "outgoing";

export type Granularity = "day" | "week" | "month";

// If in the future the WASM team adds a "pool" field we can narrow it here.
// Por ahora lo dejamos como string para no pelear con su definición.
export type Pool = string;

export interface TimeSeriesPoint {
  timestamp: number; // bucket start in epoch seconds
  value: number;
}

export interface AggregateStats {
  totalReceived: number;
  totalSent: number;
  netFlow: number;
  txCount: number;
  averageTxAmount: number | null;
}

export interface ActivityByDayOfWeek {
  // 0 = Sunday, 6 = Saturday
  [weekday: number]: {
    txCount: number;
    volumeReceived: number;
    volumeSent: number;
  };
}

export interface DashboardFilters {
  fromTimestamp?: number;
  toTimestamp?: number;
  direction?: DirectionFilter;
  pool?: Pool | "all";
  granularity?: Granularity;
}

export interface DashboardData {
  stats: AggregateStats;
  balanceOverTime: TimeSeriesPoint[];
  volumeOverTime: {
    incoming: TimeSeriesPoint[];
    outgoing: TimeSeriesPoint[];
    netFlow: TimeSeriesPoint[];
  };
  txCountOverTime: TimeSeriesPoint[];
  activityByDayOfWeek: ActivityByDayOfWeek;
}

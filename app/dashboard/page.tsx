"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useDashboardData } from "@/hooks/useDashboardData";
import {
  DashboardFilters,
  Granularity,
  TimeSeriesPoint,
  ZRayBalances,
} from "@/lib/analytics/types";
import { useZRaySession } from "@/lib/state/session-context";
import { isDemoMode } from "@/lib/config/demo-mode";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const DEFAULT_DAYS_RANGE = 30;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PIE_COLORS = ["#22c55e", "#38bdf8", "#f97316", "#a855f7", "#fbbf24"];

function createDefaultFilters(): DashboardFilters {
  const now = Math.floor(Date.now() / 1000);
  const from = now - DEFAULT_DAYS_RANGE * 24 * 60 * 60;

  return {
    fromTimestamp: from,
    toTimestamp: now,
    direction: "all",
    granularity: "day",
  };
}

function getTotalBalance(balances: ZRayBalances | null): number {
  if (!balances) return 0;
  return (balances.confirmed ?? 0) + (balances.unconfirmed ?? 0);
}

/* ------------------ Helpers de métricas avanzadas ------------------ */

function safeAmount(tx: any): number {
  const a = tx?.amountZec;
  return typeof a === "number" ? a : 0;
}

function safeTimestamp(tx: any): number | undefined {
  const t = tx?.timestamp;
  return typeof t === "number" ? t : undefined;
}

function safeDirection(tx: any): string | undefined {
  const d = tx?.direction;
  return typeof d === "string" ? d : undefined;
}

function safePool(tx: any): string {
  const p = tx?.pool;
  if (typeof p === "string" && p.length > 0) return p;
  return "shielded";
}

function computeAvgTxSize(transactions: any[]): number {
  if (!transactions.length) return 0;
  const total = transactions.reduce((sum, tx) => sum + Math.abs(safeAmount(tx)), 0);
  return total / transactions.length;
}

function computeLargestIn(transactions: any[]): number {
  let max = 0;
  for (const tx of transactions) {
    const dir = safeDirection(tx);
    const amount = safeAmount(tx);
    if (dir === "incoming" && amount > max) max = amount;
  }
  return max;
}

function computeLargestOut(transactions: any[]): number {
  let max = 0;
  for (const tx of transactions) {
    const dir = safeDirection(tx);
    const amount = Math.abs(safeAmount(tx));
    if (dir === "outgoing" && amount > max) max = amount;
  }
  return max;
}

function computeActiveDays(transactions: any[]): number {
  const days = new Set<string>();
  for (const tx of transactions) {
    const ts = safeTimestamp(tx);
    if (!ts) continue;
    const d = new Date(ts * 1000);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    days.add(key);
  }
  return days.size;
}

function buildDirectionBreakdownFromStats(stats: {
  totalReceived: number;
  totalSent: number;
}) {
  const incoming = stats.totalReceived ?? 0;
  const outgoing = Math.abs(stats.totalSent ?? 0);

  return [
    { label: "Incoming", value: incoming },
    { label: "Outgoing", value: outgoing },
  ];
}

function buildPoolBreakdownFromTransactions(transactions: any[]) {
  const map = new Map<string, number>();

  for (const tx of transactions) {
    const pool = safePool(tx);
    const amount = Math.abs(safeAmount(tx));
    map.set(pool, (map.get(pool) ?? 0) + amount);
  }

  return Array.from(map.entries()).map(([pool, value]) => ({
    pool,
    value,
  }));
}

function buildWeekdayActivity(transactions: any[]) {
  const counts = new Array(7).fill(0);

  for (const tx of transactions) {
    const ts = safeTimestamp(tx);
    if (!ts) continue;
    const d = new Date(ts * 1000);
    const weekday = d.getUTCDay(); // 0–6
    counts[weekday] += 1;
  }

  return counts.map((value, idx) => ({
    label: WEEKDAY_LABELS[idx],
    value,
  }));
}

interface TopTxRow {
  id: string;
  timestamp?: number;
  direction?: string;
  amount: number;
}

function buildTopTransactions(transactions: any[], limit: number): TopTxRow[] {
  const mapped: TopTxRow[] = transactions.map((tx: any, index: number) => {
    const amount = safeAmount(tx);
    const ts = safeTimestamp(tx);
    const dir = safeDirection(tx);

    const txid =
      (typeof tx?.txid === "string" && tx.txid.length > 0
        ? tx.txid
        : `tx-${index}`) as string;

    return {
      id: txid,
      timestamp: ts,
      direction: dir,
      amount,
    };
  });

  mapped.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  return mapped.slice(0, limit);
}

function formatDateLabelFromTimestamp(ts?: number): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/* ------------------ Componente principal ------------------ */

export default function DashboardPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<DashboardFilters>(createDefaultFilters);
  const { status, data, balances, transactions } = useDashboardData(filters);
  const { state } = useZRaySession();

  const handleGoToLanding = () => {
    const target = isDemoMode() ? "/?demo=1" : "/";
    router.push(target);
  };

  const handleGranularityChange = (granularity: Granularity) => {
    setFilters((prev) => ({ ...prev, granularity }));
  };

  const handleQuickRangeChange = (days: number) => {
    const now = Math.floor(Date.now() / 1000);
    const from = now - days * 24 * 60 * 60;
    setFilters((prev) => ({
      ...prev,
      fromTimestamp: from,
      toTimestamp: now,
    }));
  };

  const handleCustomRangeChange = (from?: number, to?: number) => {
    setFilters((prev) => ({
      ...prev,
      fromTimestamp: from,
      toTimestamp: to,
    }));
  };

  // 1) No session
  if (status === "no-session") {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          No active session
        </h1>
        <p className="mb-4 max-w-md text-center text-sm text-muted-foreground">
          To view your private dashboard, you need to start a Z-Ray session with
          a viewing key. Your data will be decrypted locally in this browser
          only.
        </p>
        <button
          type="button"
          onClick={handleGoToLanding}
          className="rounded-xl border border-amber-500/60 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.25)] transition hover:bg-amber-500/20"
        >
          Go to onboarding
        </button>
      </main>
    );
  }

  // 2) Syncing / scanning
  if (status === "syncing") {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          Syncing your private data
        </h1>
        <p className="mb-4 max-w-md text-center text-sm text-muted-foreground">
          Z-Ray is scanning the chain and decrypting your shielded transactions
          locally. This can take a moment, especially for older wallets.
        </p>
        <p className="rounded-full border border-sky-500/60 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
          Current phase: {state.phase}
        </p>
      </main>
    );
  }

  // 3) Empty
  if (status === "empty") {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          No transactions yet
        </h1>
        <p className="mb-4 max-w-md text-center text-sm text-muted-foreground">
          We could not find any transactions for this viewing key in the current
          time range. Once your wallet receives or sends ZEC, your private
          dashboard will light up.
        </p>
      </main>
    );
  }

  // 4) Error
  if (status === "error" || !data) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          Dashboard unavailable
        </h1>
        <p className="mb-4 max-w-md text-center text-sm text-muted-foreground">
          Something went wrong while loading your analytics. Please check your
          session status in the explorer and try again.
        </p>
      </main>
    );
  }

  // 5) Ready
  const { stats, balanceOverTime, volumeOverTime, txCountOverTime } = data;

  const directionBreakdown = buildDirectionBreakdownFromStats(stats);
  const poolBreakdown = buildPoolBreakdownFromTransactions(transactions);
  const weekdayActivity = buildWeekdayActivity(transactions);
  const topTxRows = buildTopTransactions(transactions, 6);

  const avgSize = computeAvgTxSize(transactions);
  const largestIn = computeLargestIn(transactions);
  const largestOut = computeLargestOut(transactions);
  const activeDays = computeActiveDays(transactions);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      {/* Header + filters */}
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Private dashboard
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            All metrics are computed locally from your decrypted transactions.
            Nothing leaves this browser.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <QuickRangeSelector
            currentFrom={filters.fromTimestamp}
            currentTo={filters.toTimestamp}
            onChange={handleQuickRangeChange}
          />
          <DateRangeSelector
            fromTimestamp={filters.fromTimestamp}
            toTimestamp={filters.toTimestamp}
            onChange={handleCustomRangeChange}
          />
          <GranularitySelector
            granularity={filters.granularity ?? "day"}
            onChange={handleGranularityChange}
          />
        </div>
      </section>

      {/* KPI cards principales */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Total received"
          value={stats.totalReceived}
          suffix="ZEC"
        />
        <KpiCard label="Total sent" value={stats.totalSent} suffix="ZEC" />
        <KpiCard label="Net flow" value={stats.netFlow} suffix="ZEC" />
        <KpiCard label="Transactions" value={stats.txCount} />
        <KpiCard
          label="Current balance"
          value={getTotalBalance(balances)}
          suffix="ZEC"
        />
      </section>

      {/* KPI cards avanzados */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Avg tx size" value={avgSize} suffix="ZEC" />
        <KpiCard label="Largest incoming" value={largestIn} suffix="ZEC" />
        <KpiCard
          label="Largest outgoing"
          value={largestOut ? -largestOut : 0}
          suffix="ZEC"
        />
        <KpiCard label="Active days" value={activeDays} />
      </section>

      {/* Charts – línea base */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Balance over time">
            <BalanceChart
              data={balanceOverTime}
              granularity={filters.granularity ?? "day"}
            />
          </ChartCard>
        </div>

        <div className="lg:col-span-1">
          <ChartCard title="Transaction count">
            <TxCountChart
              data={txCountOverTime}
              granularity={filters.granularity ?? "day"}
            />
          </ChartCard>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Incoming vs outgoing volume">
          <VolumeChart
            incoming={volumeOverTime.incoming}
            outgoing={volumeOverTime.outgoing}
            granularity={filters.granularity ?? "day"}
          />
        </ChartCard>

        <ChartCard title="Incoming vs outgoing share">
          <DirectionPieChart data={directionBreakdown} />
        </ChartCard>
      </section>

      {/* Charts + tabla extra */}
      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Activity by weekday">
          <WeekdayChart data={weekdayActivity} />
        </ChartCard>

        <ChartCard title="Volume by pool">
          <PoolPieChart data={poolBreakdown} />
        </ChartCard>

        <TopTransactionsCard rows={topTxRows} />
      </section>
    </main>
  );
}

/* ------------------ Filters components ------------------ */

interface QuickRangeSelectorProps {
  currentFrom?: number;
  currentTo?: number;
  onChange: (days: number) => void;
}

function QuickRangeSelector({
  currentFrom,
  currentTo,
  onChange,
}: QuickRangeSelectorProps) {
  const now = Math.floor(Date.now() / 1000);

  const isActive = (days: number) => {
    if (currentFrom == null || currentTo == null) return false;
    const expectedFrom = now - days * 24 * 60 * 60;
    const diff =
      (currentTo ?? 0) - (currentFrom ?? 0) - days * 24 * 60 * 60;
    return (
      Math.abs(diff) < 5 * 60 &&
      Math.abs(currentFrom - expectedFrom) < 24 * 60 * 60
    );
  };

  const options = [7, 30, 90];

  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900/60 text-xs">
      {options.map((days) => (
        <button
          key={days}
          type="button"
          onClick={() => onChange(days)}
          className="px-3 py-1.5 text-[11px] font-medium text-zinc-300 transition hover:bg-zinc-800 data-[active=true]:bg-emerald-500/15 data-[active=true]:text-emerald-300"
          data-active={isActive(days)}
        >
          {days}d
        </button>
      ))}
    </div>
  );
}

interface DateRangeSelectorProps {
  fromTimestamp?: number;
  toTimestamp?: number;
  onChange: (from?: number, to?: number) => void;
}

function toDateInputValue(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return Math.floor(d.getTime() / 1000);
}

function DateRangeSelector({
  fromTimestamp,
  toTimestamp,
  onChange,
}: DateRangeSelectorProps) {
  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const from = parseDateInputValue(e.target.value);
    const to = toTimestamp;
    onChange(from, to);
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const to = parseDateInputValue(e.target.value);
    const from = fromTimestamp;
    onChange(from, to);
  };

  return (
    <div className="flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs">
      <span className="hidden text-[10px] font-medium uppercase text-zinc-500 sm:inline">
        Custom range
      </span>
      <input
        type="date"
        className="w-[8.5rem] bg-transparent text-xs text-zinc-100 outline-none"
        value={toDateInputValue(fromTimestamp)}
        onChange={handleFromChange}
      />
      <span className="text-[10px] text-zinc-500">–</span>
      <input
        type="date"
        className="w-[8.5rem] bg-transparent text-xs text-zinc-100 outline-none"
        value={toDateInputValue(toTimestamp)}
        onChange={handleToChange}
      />
    </div>
  );
}

interface GranularitySelectorProps {
  granularity: Granularity;
  onChange: (granularity: Granularity) => void;
}

function GranularitySelector({
  granularity,
  onChange,
}: GranularitySelectorProps) {
  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900/60 text-xs">
      {(["day", "week", "month"] as const).map((g) => (
        <button
          key={g}
          type="button"
          onClick={() => onChange(g)}
          className="px-3 py-1.5 text-[11px] font-medium uppercase text-zinc-300 transition hover:bg-zinc-800 data-[active=true]:bg-sky-500/15 data-[active=true]:text-sky-300"
          data-active={granularity === g}
        >
          {g}
        </button>
      ))}
    </div>
  );
}

/* ------------------ KPI & Card components ------------------ */

interface KpiCardProps {
  label: string;
  value: number | string | null;
  suffix?: string;
}

function KpiCard({ label, value, suffix }: KpiCardProps) {
  const formatted =
    typeof value === "number"
      ? value.toLocaleString(undefined, {
          maximumFractionDigits: 4,
        })
      : value ?? "—";

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-900 px-4 py-3 shadow-[0_0_18px_rgba(15,23,42,0.4)]">
      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-lg font-semibold text-zinc-50">{formatted}</span>
        {suffix && (
          <span className="text-xs font-medium text-zinc-500">{suffix}</span>
        )}
      </div>
    </div>
  );
}

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
}

function ChartCard({ title, children }: ChartCardProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-900 p-4 shadow-[0_0_24px_rgba(0,0,0,0.65)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-50">{title}</h2>
      </div>
      <div className="h-64 w-full flex-1">{children}</div>
    </div>
  );
}

/* ------------------ Chart helpers ------------------ */

function formatXAxisLabel(
  timestamp: number,
  granularity: Granularity
): string {
  const d = new Date(timestamp * 1000);
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");

  if (granularity === "day") {
    return `${month}-${day}`;
  }
  if (granularity === "week") {
    return `W${getIsoWeek(d)} ${d.getUTCFullYear()}`;
  }
  // month
  return `${d.getUTCFullYear()}-${month}`;
}

function getIsoWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/* ------------------ Chart components ------------------ */

interface BalanceChartProps {
  data: TimeSeriesPoint[];
  granularity: Granularity;
}

function toChartData(
  data: TimeSeriesPoint[],
  granularity: Granularity
): { timestamp: number; label: string; value: number }[] {
  return data.map((p) => ({
    timestamp: p.timestamp,
    label: formatXAxisLabel(p.timestamp, granularity),
    value: p.value,
  }));
}

function BalanceChart({ data, granularity }: BalanceChartProps) {
  const chartData = toChartData(data, granularity);

  if (chartData.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No data available for the selected range.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={chartData}
        margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
      >
        <defs>
          <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
        <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
        <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#020617",
            border: "1px solid #27272a",
            fontSize: 11,
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#22c55e"
          strokeWidth={1.8}
          fill="url(#balanceGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface TxCountChartProps {
  data: TimeSeriesPoint[];
  granularity: Granularity;
}

function TxCountChart({ data, granularity }: TxCountChartProps) {
  const chartData = toChartData(data, granularity);

  if (chartData.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No transactions in the selected range.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
        <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "#a1a1aa", fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#020617",
            border: "1px solid #27272a",
            fontSize: 11,
          }}
        />
        <Bar dataKey="value" radius={4} fill="#38bdf8" />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface VolumeChartProps {
  incoming: TimeSeriesPoint[];
  outgoing: TimeSeriesPoint[];
  granularity: Granularity;
}

interface VolumePoint {
  timestamp: number;
  label: string;
  incoming: number;
  outgoing: number;
}

function mergeVolumeSeries(
  incoming: TimeSeriesPoint[],
  outgoing: TimeSeriesPoint[],
  granularity: Granularity
): VolumePoint[] {
  const map = new Map<number, VolumePoint>();

  for (const p of incoming) {
    const label = formatXAxisLabel(p.timestamp, granularity);
    const existing = map.get(p.timestamp) ?? {
      timestamp: p.timestamp,
      label,
      incoming: 0,
      outgoing: 0,
    };
    existing.incoming = p.value;
    map.set(p.timestamp, existing);
  }

  for (const p of outgoing) {
    const label = formatXAxisLabel(p.timestamp, granularity);
    const existing = map.get(p.timestamp) ?? {
      timestamp: p.timestamp,
      label,
      incoming: 0,
      outgoing: 0,
    };
    existing.outgoing = p.value;
    map.set(p.timestamp, existing);
  }

  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function VolumeChart({ incoming, outgoing, granularity }: VolumeChartProps) {
  const chartData = mergeVolumeSeries(incoming, outgoing, granularity);

  if (chartData.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No volume in the selected range.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
        <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
        <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#020617",
            border: "1px solid #27272a",
            fontSize: 11,
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#e5e5e5" }}
        />
        <Bar
          dataKey="incoming"
          name="Incoming"
          stackId="volume"
          fill="#22c55e"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="outgoing"
          name="Outgoing"
          stackId="volume"
          fill="#ef4444"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* Pie incoming vs outgoing */

type DirectionSlice = {
  label: string;
  value: number;
  [key: string]: string | number;
};

interface DirectionPieChartProps {
  data: DirectionSlice[];
}

function DirectionPieChart({ data }: DirectionPieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (!data.length || total === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No volume to display yet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip
          contentStyle={{
            backgroundColor: "#020617",
            border: "1px solid #27272a",
            fontSize: 11,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#e5e5e5" }} />
        <Pie data={data} dataKey="value" nameKey="label" outerRadius="80%">
          {data.map((entry, index) => (
            <Cell
              key={entry.label}
              fill={PIE_COLORS[index % PIE_COLORS.length]}
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

/* Weekday chart */

interface WeekdayPoint {
  label: string;
  value: number;
}

interface WeekdayChartProps {
  data: WeekdayPoint[];
}

function WeekdayChart({ data }: WeekdayChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (!total) {
    return (
      <p className="text-xs text-muted-foreground">
        No weekday activity in the selected range.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
        <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "#a1a1aa", fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#020617",
            border: "1px solid #27272a",
            fontSize: 11,
          }}
        />
        <Bar dataKey="value" radius={4} fill="#f97316" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* Pool pie */

type PoolSlice = {
  pool: string;
  value: number;
  [key: string]: string | number;
};

interface PoolPieChartProps {
  data: PoolSlice[];
}

function PoolPieChart({ data }: PoolPieChartProps) {
  const filtered = data.filter((d) => d.value > 0);
  const total = filtered.reduce((sum, d) => sum + d.value, 0);

  if (!filtered.length || total === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No pool breakdown available for this range.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip
          contentStyle={{
            backgroundColor: "#020617",
            border: "1px solid #27272a",
            fontSize: 11,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#e5e5e5" }} />
        <Pie
          data={filtered}
          dataKey="value"
          nameKey="pool"
          outerRadius="80%"
        >
          {filtered.map((entry, index) => (
            <Cell
              key={entry.pool}
              fill={PIE_COLORS[index % PIE_COLORS.length]}
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

/* Top transactions card */

interface TopTransactionsCardProps {
  rows: TopTxRow[];
}

function TopTransactionsCard({ rows }: TopTransactionsCardProps) {
  if (!rows.length) {
    return (
      <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-900 p-4 shadow-[0_0_24px_rgba(0,0,0,0.65)]">
        <h2 className="mb-3 text-sm font-semibold text-zinc-50">
          Largest transactions
        </h2>
        <p className="text-xs text-muted-foreground">
          No transactions available in this range.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-900 p-4 shadow-[0_0_24px_rgba(0,0,0,0.65)]">
      <h2 className="mb-3 text-sm font-semibold text-zinc-50">
        Largest transactions
      </h2>
      <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/70">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80 text-[11px] text-zinc-400">
              <th className="py-2 pl-3 pr-2 text-left font-medium">Date</th>
              <th className="py-2 px-2 text-left font-medium">Direction</th>
              <th className="py-2 pr-3 pl-2 text-right font-medium">
                Amount (ZEC)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const dateLabel = formatDateLabelFromTimestamp(row.timestamp);
              const dir = row.direction ?? "—";
              const isIncoming = row.direction === "incoming";

              return (
                <tr
                  key={row.id}
                  className={`border-b border-zinc-800/70 last:border-0 ${
                    idx % 2 === 0 ? "bg-zinc-950" : "bg-zinc-950/60"
                  }`}
                >
                  <td className="py-1.5 pl-3 pr-2 align-middle text-zinc-200">
                    {dateLabel}
                  </td>
                  <td className="py-1.5 px-2 align-middle">
                    {dir === "—" ? (
                      <span className="text-[11px] text-zinc-500">—</span>
                    ) : (
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                          isIncoming
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-red-500/15 text-red-300",
                        ].join(" ")}
                      >
                        {isIncoming ? "Incoming" : "Outgoing"}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 pl-2 text-right align-middle text-zinc-100">
                    {row.amount.toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-zinc-500">
        Largest movements in the selected range, based on absolute ZEC amount.
      </p>
    </div>
  );
}

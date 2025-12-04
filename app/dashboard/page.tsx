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
} from "recharts";

const DEFAULT_DAYS_RANGE = 30;

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
  // Light client defines confirmed / unconfirmed.
  // For the dashboard we show total = confirmed + unconfirmed.
  return (balances.confirmed ?? 0) + (balances.unconfirmed ?? 0);
}

export default function DashboardPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<DashboardFilters>(createDefaultFilters);
  const { status, data, balances } = useDashboardData(filters);
  const { state } = useZRaySession();

  const handleGoToLanding = () => {
    router.push("/");
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
          className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-accent"
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
        <p className="text-xs text-muted-foreground">
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

      {/* KPI cards */}
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

      {/* Charts */}
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
        {/* Hook spot for future charts, e.g. ActivityByDayOfWeek */}
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
    return Math.abs(diff) < 5 * 60;
  };

  const options = [7, 30, 90];

  return (
    <div className="inline-flex rounded-xl border text-xs">
      {options.map((days) => (
        <button
          key={days}
          type="button"
          onClick={() => onChange(days)}
          className="px-3 py-1.5 hover:bg-accent data-[active=true]:bg-accent data-[active=true]:font-medium"
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
    <div className="flex items-center gap-1 rounded-xl border px-2 py-1 text-xs">
      <span className="hidden text-[10px] font-medium uppercase text-muted-foreground sm:inline">
        Custom range
      </span>
      <input
        type="date"
        className="w-[8.5rem] bg-transparent text-xs outline-none"
        value={toDateInputValue(fromTimestamp)}
        onChange={handleFromChange}
      />
      <span className="text-[10px] text-muted-foreground">–</span>
      <input
        type="date"
        className="w-[8.5rem] bg-transparent text-xs outline-none"
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
    <div className="inline-flex rounded-xl border text-xs">
      {(["day", "week", "month"] as const).map((g) => (
        <button
          key={g}
          type="button"
          onClick={() => onChange(g)}
          className="px-3 py-1.5 uppercase hover:bg-accent data-[active=true]:bg-accent data-[active=true]:font-medium"
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
    <div className="flex flex-col justify-between rounded-2xl border bg-card px-4 py-3 shadow-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-lg font-semibold">{formatted}</span>
        {suffix && (
          <span className="text-xs font-medium text-muted-foreground">
            {suffix}
          </span>
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
    <div className="flex h-full flex-col rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="h-64 w-full flex-1">
        {children}
      </div>
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
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
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
      <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" />
        <YAxis />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="value"
          strokeWidth={1.5}
          fillOpacity={0.2}
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
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="value" />
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

  return Array.from(map.values()).sort(
    (a, b) => a.timestamp - b.timestamp
  );
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
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="incoming" />
        <Bar dataKey="outgoing" />
      </BarChart>
    </ResponsiveContainer>
  );
}

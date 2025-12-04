"use client";

import { useRouter } from "next/navigation";
import { useZRaySession } from "@/lib/state/session-context";
import { useSensitiveData } from "@/lib/state/sensitive-data-context";
import { PrivateViewBadge } from "@/components/explorer/PrivateViewBadge";

export default function ExplorerPage() {
  const router = useRouter();
  const { state, syncNow, clearSession } = useZRaySession();
  const { clearSensitiveData } = useSensitiveData();

  const phase = state?.phase ?? "NO_SESSION";
  const hasViewingKey = state?.hasViewingKey ?? false;
  const network = state?.network ?? "mainnet";
  const lastErrorMessage =
    typeof state?.lastError === "string"
      ? state.lastError
      : state?.lastError?.message ?? null;

  const handleClearSession = () => {
    // Clear ephemeral session state and in-memory decrypted data.
    clearSession();
    clearSensitiveData?.();
  };

  const handleGoToOnboarding = () => {
    router.push("/");
  };

  const isLive = phase === "LIVE";
  const isSyncing = phase === "SYNCING" || phase === "SCANNING";

  return (
    <main className="min-h-[calc(100vh-3.5rem)] w-full px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
              Private explorer
            </h1>
            <p className="text-xs leading-relaxed text-zinc-400 sm:text-sm">
              View decrypted Zcash activity for your viewing key. All decryption
              happens in a local WASM light client.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              Network: {network}
            </span>
            <PrivateViewBadge active={isLive && hasViewingKey} />
          </div>
        </header>

        {/* Main grid */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          {/* Left: session summary + danger zone */}
          <section className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
            <SessionStateSummary
              phase={phase}
              hasViewingKey={hasViewingKey}
              onGoToOnboarding={handleGoToOnboarding}
              onSyncNow={syncNow}
              isSyncing={isSyncing}
            />

            <div className="h-px bg-zinc-800" />

            <DangerZone onClearSession={handleClearSession} />
          </section>

          {/* Right: phase content */}
          <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
            {phase === "NO_SESSION" || !hasViewingKey ? (
              <NoSessionPanel onGoToOnboarding={handleGoToOnboarding} />
            ) : null}

            {phase === "INITIALIZING" ? <InitializingPanel /> : null}

            {phase === "READY_TO_SYNC" ? (
              <ReadyToSyncPanel onSyncNow={syncNow} />
            ) : null}

            {isSyncing ? <SyncingPanel phase={phase} /> : null}

            {phase === "LIVE" ? <LivePanel /> : null}

            {phase === "ERROR" ? (
              <ErrorPanel
                message={lastErrorMessage}
                onRetry={syncNow}
                onGoToSettings={() => router.push("/settings")}
              />
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

/* --- Left side session summary & danger zone --- */

type SessionStateSummaryProps = {
  phase: string;
  hasViewingKey: boolean;
  onGoToOnboarding: () => void;
  onSyncNow: () => void;
  isSyncing: boolean;
};

function SessionStateSummary({
  phase,
  hasViewingKey,
  onGoToOnboarding,
  onSyncNow,
  isSyncing,
}: SessionStateSummaryProps) {
  if (!hasViewingKey || phase === "NO_SESSION") {
    return (
      <div className="space-y-2.5 text-sm">
        <p className="text-xs font-semibold text-zinc-100">
          No private view is active
        </p>
        <p className="text-[11px] leading-relaxed text-zinc-400">
          Start from the home screen with a Zcash viewing key to enable the
          private explorer.
        </p>
        <button
          type="button"
          onClick={onGoToOnboarding}
          className="mt-1 inline-flex items-center justify-center rounded-md bg-amber-400 px-3 py-1.5 text-[11px] font-medium text-zinc-950 shadow-[0_0_16px_rgba(251,191,36,0.5)] transition hover:bg-amber-300"
        >
          Start a private view
        </button>
      </div>
    );
  }

  if (phase === "READY_TO_SYNC") {
    return (
      <div className="space-y-2.5 text-sm">
        <p className="text-xs font-semibold text-zinc-100">Ready to sync</p>
        <p className="text-[11px] leading-relaxed text-zinc-400">
          The private client is ready. Start a sync to fetch and decrypt
          shielded activity for this viewing key.
        </p>
        <button
          type="button"
          onClick={onSyncNow}
          className="mt-1 inline-flex items-center justify-center rounded-md bg-amber-400 px-3 py-1.5 text-[11px] font-medium text-zinc-950 shadow-[0_0_16px_rgba(251,191,36,0.5)] transition hover:bg-amber-300"
        >
          Start sync now
        </button>
      </div>
    );
  }

  if (isSyncing || phase === "INITIALIZING") {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-xs font-semibold text-zinc-100">
          {phase === "INITIALIZING"
            ? "Preparing private client…"
            : "Syncing private view…"}
        </p>
        <p className="text-[11px] leading-relaxed text-zinc-400">
          Z-Ray is wiring the WASM light client to lightwalletd and processing
          compact blocks. The first scan can take a while.
        </p>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-sky-400" />
        </div>
      </div>
    );
  }

  if (phase === "LIVE") {
    return (
      <div className="space-y-2.5 text-sm">
        <p className="text-xs font-semibold text-zinc-100">
          Live private session
        </p>
        <p className="text-[11px] leading-relaxed text-zinc-400">
          The WASM light client is synced and ready to serve decrypted
          transactions to the explorer and dashboard.
        </p>
      </div>
    );
  }

  if (phase === "ERROR") {
    return (
      <div className="space-y-2.5 text-sm">
        <p className="text-xs font-semibold text-red-300">Sync error</p>
        <p className="text-[11px] leading-relaxed text-zinc-400">
          Something went wrong while syncing or decrypting. You can retry the
          sync or inspect endpoint configuration in settings.
        </p>
        <button
          type="button"
          onClick={onSyncNow}
          className="mt-1 inline-flex items-center justify-center rounded-md bg-amber-400 px-3 py-1.5 text-[11px] font-medium text-zinc-950 shadow-[0_0_16px_rgba(251,191,36,0.5)] transition hover:bg-amber-300"
        >
          Retry sync
        </button>
      </div>
    );
  }

  return null;
}

type DangerZoneProps = {
  onClearSession: () => void;
};

function DangerZone({ onClearSession }: DangerZoneProps) {
  return (
    <div className="space-y-2 rounded-xl border border-red-900/70 bg-red-950/40 p-3 text-[11px] text-red-100">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-red-500/60 bg-red-500/20 text-[10px] font-bold">
          !
        </span>
        <p className="font-semibold">Clear data &amp; remove viewing key</p>
      </div>
      <p className="leading-relaxed text-red-200/80">
        This wipes the in-memory private session and all decrypted data. Use
        this on shared or untrusted devices once you are done.
      </p>
      <button
        type="button"
        onClick={onClearSession}
        className="mt-1 inline-flex items-center justify-center rounded-md border border-red-500/70 bg-red-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-red-500"
      >
        Clear session
      </button>
    </div>
  );
}

/* --- Right side panels per phase --- */

type NoSessionPanelProps = {
  onGoToOnboarding: () => void;
};

function NoSessionPanel({ onGoToOnboarding }: NoSessionPanelProps) {
  return (
    <div className="space-y-3 text-sm">
      <h2 className="text-base font-semibold text-zinc-50">
        No private view is active
      </h2>
      <p className="text-[13px] leading-relaxed text-zinc-400">
        To use the explorer, start a private view from the home screen with a
        Zcash unified viewing key. Z-Ray will then sync and decrypt shielded
        activity locally.
      </p>
      <button
        type="button"
        onClick={onGoToOnboarding}
        className="inline-flex items-center justify-center rounded-md bg-amber-400 px-4 py-2 text-xs font-medium text-zinc-950 shadow-[0_0_16px_rgba(251,191,36,0.5)] transition hover:bg-amber-300"
      >
        Start a private view
      </button>
    </div>
  );
}

function InitializingPanel() {
  return (
    <div className="space-y-3 text-sm">
      <h2 className="text-base font-semibold text-zinc-50">
        Preparing private client…
      </h2>
      <p className="text-[13px] leading-relaxed text-zinc-400">
        Z-Ray is instantiating the WASM-based light client and wiring it to the
        active lightwalletd endpoints. This usually takes a few seconds.
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-zinc-600" />
      </div>
    </div>
  );
}

type ReadyToSyncPanelProps = {
  onSyncNow: () => void;
};

function ReadyToSyncPanel({ onSyncNow }: ReadyToSyncPanelProps) {
  return (
    <div className="space-y-3 text-sm">
      <h2 className="text-base font-semibold text-zinc-50">Ready to sync</h2>
      <p className="text-[13px] leading-relaxed text-zinc-400">
        The private client is ready. Start a sync to fetch and decrypt
        shielded activity for your viewing key.
      </p>
      <button
        type="button"
        onClick={onSyncNow}
        className="inline-flex items-center justify-center rounded-md bg-amber-400 px-4 py-2 text-xs font-medium text-zinc-950 shadow-[0_0_16px_rgba(251,191,36,0.5)] transition hover:bg-amber-300"
      >
        Start sync now
      </button>
    </div>
  );
}

type SyncingPanelProps = {
  phase: string;
};

function SyncingPanel({ phase }: SyncingPanelProps) {
  const label =
    phase === "SCANNING"
      ? "Scanning decrypted transactions…"
      : "Syncing with the Zcash network…";

  return (
    <div className="space-y-3 text-sm">
      <h2 className="text-base font-semibold text-zinc-50">{label}</h2>
      <p className="text-[13px] leading-relaxed text-zinc-400">
        Z-Ray is fetching compact blocks from lightwalletd and feeding them into
        the local light client. This may take a while on first use.
      </p>
      <div className="space-y-1.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-sky-400" />
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-500">
          Progress is simulated in this MVP. The real client will report sync
          height and percentage.
        </p>
      </div>
    </div>
  );
}

function LivePanel() {
  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-50">
          Live private view
        </h2>
        <p className="text-[13px] leading-relaxed text-zinc-400">
          Your private view is active. Once the WASM light client exposes
          decrypted data, your transactions will appear here. For now, this is a
          scaffold for the upcoming transaction list and analytics.
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/80 p-4 text-xs text-zinc-300">
        <p className="font-medium text-zinc-100">Transactions placeholder</p>
        <p className="text-[11px] leading-relaxed text-zinc-400">
          The Explorer and Dashboard will read decrypted transactions from the
          in-memory sensitive data store. Until the WASM bridge is fully wired,
          this area remains a visual placeholder.
        </p>
      </div>
    </div>
  );
}

type ErrorPanelProps = {
  message: string | null;
  onRetry: () => void;
  onGoToSettings: () => void;
};

function ErrorPanel({ message, onRetry, onGoToSettings }: ErrorPanelProps) {
  return (
    <div className="space-y-3 text-sm">
      <h2 className="text-base font-semibold text-red-300">
        Something went wrong
      </h2>
      <p className="text-[13px] leading-relaxed text-zinc-400">
        Z-Ray could not complete the private sync. This may be caused by
        unhealthy lightwalletd endpoints, network issues, or an invalid viewing
        key.
      </p>
      {message ? (
        <p className="rounded-md bg-red-950/70 px-3 py-2 text-[11px] leading-relaxed text-red-200">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center rounded-md bg-amber-400 px-4 py-2 text-xs font-medium text-zinc-950 shadow-[0_0_16px_rgba(251,191,36,0.5)] transition hover:bg-amber-300"
        >
          Retry sync
        </button>
        <button
          type="button"
          onClick={onGoToSettings}
          className="inline-flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-900"
        >
          Check settings
        </button>
      </div>
    </div>
  );
}

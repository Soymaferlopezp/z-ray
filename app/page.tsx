"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useZRaySession } from "@/lib/state/session-context";
import { useUISettings } from "@/lib/state/ui-settings-context";

type ZRayNetwork = "mainnet" | "testnet";

export default function LandingPage() {
  const router = useRouter();
  const { startSession } = useZRaySession();
  const { preferredNetwork, setPreferredNetwork } = useUISettings();

  const [demoEnabled, setDemoEnabled] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const ufvk = (formData.get("ufvk") || "").toString().trim();
    const network =
      (formData.get("network") as ZRayNetwork | null) ||
      (preferredNetwork as ZRayNetwork) ||
      "mainnet";

    if (!ufvk) {
      alert("Please paste a valid viewing key before starting the scan.");
      return;
    }

    // DO NOT start real session when in demo
    if (!demoEnabled) {
      startSession({ ufvk, network });
    }

    const qs = demoEnabled ? "?demo=1" : "";
    router.push(`/explorer${qs}`);
  };

  const handleNetworkChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as ZRayNetwork;
    setPreferredNetwork(value);
  };

  const networkValue: ZRayNetwork =
    (preferredNetwork as ZRayNetwork) || "mainnet";

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] w-full items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
      <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:gap-14">

        {/* Left: hero + explanation */}
        <section className="flex flex-col justify-center space-y-8">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-800 shadow-sm dark:border-amber-400/60 dark:bg-zinc-900 dark:text-amber-200">
              <span className="inline-flex h-1.5 w-6 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-sky-400" />
              <span>Local-only Zcash viewing</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl dark:text-zinc-50">
                Turn your viewing key into{" "}
                <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-sky-400 bg-clip-text text-transparent">
                  laser-focused insight
                </span>
                .
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-300">
                Z-Ray decrypts your shielded Zcash activity entirely in your
                browser using a WASM-based light client. Your viewing key never
                leaves your device.
              </p>
            </div>
          </div>

          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <FeatureItem
              title="Local-only decryption"
              body="The unified viewing key is processed only inside a local WASM client."
            />
            <FeatureItem
              title="Zcash-native"
              body="Purpose-built for shielded ZEC viewing."
            />
            <FeatureItem
              title="No accounts"
              body="No logins, no tracking, no sharing of keys."
            />
          </div>

          <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-500">
            Z-Ray is an experimental research tool. Cross-check balances before
            making financial decisions.
          </p>
        </section>

        {/* Right: control panel */}
        <section className="flex items-center">
          <div className="relative w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-6 shadow-md dark:border-zinc-800 dark:bg-zinc-950/90 dark:shadow-[0_0_40px_rgba(0,0,0,0.9)]">

            {/* Demo badge */}
            {demoEnabled && (
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-400/60 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold text-sky-300">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                Demo mode active
              </div>
            )}

            {/* Toggle demo mode */}
            <button
              type="button"
              onClick={() => {
                setDemoEnabled(true);
                router.replace("/?demo=1"); // ⬅ AQUÍ ESTÁ LA MAGIA
              }}
              className="mb-4 w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-sky-400 transition"
            >
              Try demo mode
            </button>

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Viewing key */}
              <div className="space-y-2">
                <label
                  htmlFor="ufvk"
                  className="text-xs font-medium text-zinc-800 dark:text-zinc-200"
                >
                  Viewing key input
                </label>
                <textarea
                  id="ufvk"
                  name="ufvk"
                  required
                  rows={4}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-mono leading-relaxed text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  placeholder="Paste your unified viewing key here…"
                />
              </div>

              {/* Network selector */}
              <div className="space-y-2">
                <label
                  htmlFor="network"
                  className="text-xs font-medium text-zinc-800 dark:text-zinc-200"
                >
                  Network
                </label>
                <select
                  id="network"
                  name="network"
                  defaultValue={networkValue}
                  onChange={handleNetworkChange}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="mainnet">Mainnet</option>
                  <option value="testnet">Testnet</option>
                </select>
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-zinc-950 shadow-[0_0_22px_rgba(251,191,36,0.55)] transition hover:bg-amber-400"
              >
                Start private scan
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

type FeatureItemProps = {
  title: string;
  body: string;
};

function FeatureItem({ title, body }: FeatureItemProps) {
  return (
    <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
      <p className="text-xs font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
        {title}
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
        {body}
      </p>
    </div>
  );
}

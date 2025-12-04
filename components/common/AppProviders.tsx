"use client";

import React from "react";

import {
  UISettingsProvider,
  useUISettings,
} from "@/lib/state/ui-settings-context";
import {
  ZRaySessionProvider,
  useZRaySession,
} from "@/lib/state/session-context";
import { SensitiveDataProvider } from "@/lib/state/sensitive-data-context";
import { LightwalletdProvider } from "@/lib/lightwalletd/LightwalletdProvider";

/**
 * Centralized stack of providers for the entire Z-Ray application.
 *
 * Final tree:
 *
 * <UISettingsProvider>
 *   <LightwalletdProvider network={preferredNetwork}>
 *     <ZRaySessionProvider>
 *       <SensitiveDataProvider getLightClient={getLightClientFromSession}>
 *         {children}
 *       </SensitiveDataProvider>
 *     </ZRaySessionProvider>
 *   </LightwalletdProvider>
 * </UISettingsProvider>
 *
 * Responsibilities:
 * - UISettingsProvider:
 *   - Owns non-sensitive UI preferences (theme, preferred network).
 *   - Persists ONLY theme + network to localStorage.
 *   - Applies the "dark" class to <html> when needed.
 *
 * - LightwalletdProvider:
 *   - Exposes a shared LightwalletdClient for UI/network status (e.g. /settings).
 *   - Does NOT handle viewing keys or decrypted data.
 *
 * - ZRaySessionProvider:
 *   - Owns the ZRayLightClient instance and session lifecycle.
 *   - Accepts the UFVK once and forwards it to the worker/WASM.
 *   - Does NOT persist or expose the UFVK.
 *
 * - SensitiveDataProvider:
 *   - Holds decrypted transactions and balances in React memory only.
 *   - Uses getLightClient() to pull snapshots from the worker/WASM.
 *   - Does NOT persist or log any decrypted data.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <UISettingsProvider>
      <UISettingsAwareProviders>{children}</UISettingsAwareProviders>
    </UISettingsProvider>
  );
}

/**
 * Providers that depend on UI settings (e.g. preferredNetwork).
 */
function UISettingsAwareProviders({ children }: { children: React.ReactNode }) {
  const { preferredNetwork } = useUISettings();

  return (
    <LightwalletdProvider network={preferredNetwork}>
      <ZRaySessionProvider>
        <SessionScopedProviders>{children}</SessionScopedProviders>
      </ZRaySessionProvider>
    </LightwalletdProvider>
  );
}

/**
 * Providers that depend on an active Z-Ray session and light client.
 */
function SessionScopedProviders({ children }: { children: React.ReactNode }) {
  const { getLightClient } = useZRaySession();

  return (
    <SensitiveDataProvider getLightClient={getLightClient}>
      {children}
    </SensitiveDataProvider>
  );
}


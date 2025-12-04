"use client";

import React from "react";
import { UISettingsProvider } from "@/lib/state/ui-settings-context";
import {
  ZRaySessionProvider,
  useZRaySession,
} from "@/lib/state/session-context";
import { SensitiveDataProvider } from "@/lib/state/sensitive-data-context";

/**
 * Internal helper that lives *inside* ZRaySessionProvider,
 * so it can access useZRaySession() and pass getLightClient
 * down to SensitiveDataProvider.
 */
function SessionAwareProviders({ children }: { children: React.ReactNode }) {
  const { getLightClient } = useZRaySession();

  return (
    <SensitiveDataProvider getLightClient={getLightClient}>
      {children}
    </SensitiveDataProvider>
  );
}

/**
 * Centralized stack of providers for the entire Z-Ray application.
 *
 * Tree (effective):
 * <UISettingsProvider>
 *   <ZRaySessionProvider>
 *     <SensitiveDataProvider getLightClient={getLightClient}>
 *       {children}
 *     </SensitiveDataProvider>
 *   </ZRaySessionProvider>
 * </UISettingsProvider>
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <UISettingsProvider>
      <ZRaySessionProvider>
        <SessionAwareProviders>{children}</SessionAwareProviders>
      </ZRaySessionProvider>
    </UISettingsProvider>
  );
}


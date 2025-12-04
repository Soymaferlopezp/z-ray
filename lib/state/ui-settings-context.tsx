"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type { ZcashNetwork } from "../config/network-types";

export type ThemePreference = "light" | "dark" | "system";

export interface UISettingsContextValue {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  preferredNetwork: ZcashNetwork;
  setPreferredNetwork: (network: ZcashNetwork) => void;
}

const UISettingsContext = createContext<UISettingsContextValue | undefined>(
  undefined,
);

interface UISettingsProviderProps {
  children: ReactNode;
}

/**
 * Shape stored in localStorage.
 * This contains only non-sensitive preferences.
 */
interface UISettingsStorageShape {
  theme: ThemePreference;
  preferredNetwork: ZcashNetwork;
}

const STORAGE_KEY = "zray.ui.settings.v1";

const DEFAULT_PREFERENCES: UISettingsStorageShape = {
  theme: "system",
  preferredNetwork: "mainnet",
};

/**
 * Safely reads UI settings from localStorage on the client.
 */
function readSettingsFromStorage(): UISettingsStorageShape {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;

    const parsed = JSON.parse(raw) as Partial<UISettingsStorageShape>;

    return {
      theme: parsed.theme ?? DEFAULT_PREFERENCES.theme,
      preferredNetwork:
        parsed.preferredNetwork ?? DEFAULT_PREFERENCES.preferredNetwork,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Safely writes UI settings to localStorage on the client.
 */
function writeSettingsToStorage(settings: UISettingsStorageShape) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Silently ignore storage errors (e.g. private mode, quota exceeded).
  }
}

/**
 * Applies the effective theme ("light" | "dark") to the <html> element.
 * - "system" maps to the current OS preference.
 */
function applyThemeClass(theme: ThemePreference) {
  if (typeof window === "undefined") return;

  const root = window.document.documentElement;

  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const effectiveTheme: "light" | "dark" =
    theme === "system" ? (prefersDark ? "dark" : "light") : theme;

  if (effectiveTheme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

/**
 * Provider for non-sensitive UI preferences (theme, preferred network).
 *
 * Privacy:
 * - Only theme + network are persisted.
 * - No viewing keys, balances or decrypted data ever touch this layer.
 */
export function UISettingsProvider({ children }: UISettingsProviderProps) {
  const [theme, setThemeState] = useState<ThemePreference>(
    DEFAULT_PREFERENCES.theme,
  );
  const [preferredNetwork, setPreferredNetworkState] =
    useState<ZcashNetwork>(DEFAULT_PREFERENCES.preferredNetwork);

  // On mount, hydrate from localStorage and apply theme once.
  useEffect(() => {
    const stored = readSettingsFromStorage();
    setThemeState(stored.theme);
    setPreferredNetworkState(stored.preferredNetwork);
    applyThemeClass(stored.theme);
  }, []);

  // Whenever preferences change, persist them and re-apply theme.
  useEffect(() => {
    writeSettingsToStorage({ theme, preferredNetwork });
    applyThemeClass(theme);
  }, [theme, preferredNetwork]);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
  }, []);

  const setPreferredNetwork = useCallback((network: ZcashNetwork) => {
    setPreferredNetworkState(network);
  }, []);

  const value: UISettingsContextValue = {
    theme,
    setTheme,
    preferredNetwork,
    setPreferredNetwork,
  };

  return (
    <UISettingsContext.Provider value={value}>
      {children}
    </UISettingsContext.Provider>
  );
}

/**
 * Hook used by the UI to read/update non-sensitive preferences.
 *
 * Example:
 * const { theme, setTheme, preferredNetwork, setPreferredNetwork } = useUISettings();
 */
export function useUISettings(): UISettingsContextValue {
  const ctx = useContext(UISettingsContext);
  if (!ctx) {
    throw new Error("useUISettings must be used within a UISettingsProvider");
  }
  return ctx;
}

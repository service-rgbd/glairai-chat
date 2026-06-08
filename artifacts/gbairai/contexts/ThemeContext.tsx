import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState, Appearance, type ColorSchemeName } from "react-native";

import {
  getThemePreferenceLabel,
  loadThemePreference,
  resolveColorScheme,
  saveThemePreference,
  type ResolvedColorScheme,
  type ThemePreference,
} from "@/lib/app-theme";

type ThemeContextValue = {
  preference: ThemePreference;
  colorScheme: ResolvedColorScheme;
  setPreference: (next: ThemePreference) => Promise<void>;
  preferenceLabel: string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyAppearance(scheme: ResolvedColorScheme) {
  Appearance.setColorScheme(scheme as ColorSchemeName);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("auto");
  const [colorScheme, setColorScheme] = useState<ResolvedColorScheme>(() =>
    resolveColorScheme("auto"),
  );
  const [ready, setReady] = useState(false);

  const syncScheme = useCallback((nextPreference: ThemePreference) => {
    const resolved = resolveColorScheme(nextPreference);
    setColorScheme(resolved);
    applyAppearance(resolved);
    return resolved;
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadThemePreference().then((stored) => {
      if (cancelled) return;
      setPreferenceState(stored);
      syncScheme(stored);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [syncScheme]);

  useEffect(() => {
    if (!ready || preference !== "auto") return;

    syncScheme("auto");
    const timer = setInterval(() => syncScheme("auto"), 60_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncScheme("auto");
      }
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [preference, ready, syncScheme]);

  const setPreference = useCallback(
    async (next: ThemePreference) => {
      setPreferenceState(next);
      syncScheme(next);
      await saveThemePreference(next);
    },
    [syncScheme],
  );

  const value = useMemo(
    () => ({
      preference,
      colorScheme,
      setPreference,
      preferenceLabel: getThemePreferenceLabel(preference),
    }),
    [colorScheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within ThemeProvider");
  }
  return context;
}

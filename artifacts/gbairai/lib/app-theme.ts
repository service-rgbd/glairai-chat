import { safeGetItem, safeSetItem } from "@/lib/safe-storage";

export type ThemePreference = "auto" | "light" | "dark";

export type ResolvedColorScheme = "light" | "dark";

const STORAGE_KEY = "@gbairai_theme_preference_v1";

/** Mode sombre de 19h à 7h (heure locale). */
export function resolveColorScheme(preference: ThemePreference): ResolvedColorScheme {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";

  const hour = new Date().getHours();
  return hour >= 7 && hour < 19 ? "light" : "dark";
}

export function getThemePreferenceLabel(preference: ThemePreference) {
  switch (preference) {
    case "auto":
      return "Automatique";
    case "light":
      return "Clair";
    case "dark":
      return "Sombre";
  }
}

export function isThemePreference(value: string): value is ThemePreference {
  return value === "auto" || value === "light" || value === "dark";
}

export async function loadThemePreference() {
  const stored = await safeGetItem(STORAGE_KEY);
  if (stored && isThemePreference(stored)) {
    return stored;
  }
  return "auto" as const;
}

export async function saveThemePreference(preference: ThemePreference) {
  await safeSetItem(STORAGE_KEY, preference);
}

export const THEME_PREFERENCE_OPTIONS: ThemePreference[] = ["auto", "light", "dark"];

import { Platform } from "react-native";

export const STORY_TEXT_MAX_LENGTH = 700;

/** Couleurs de fond pour statuts texte (défilement horizontal). */
export const STORY_TEXT_BACKGROUNDS = [
  "#F4435D",
  "#2DD4BF",
  "#38BDF8",
  "#3B82F6",
  "#A7F3D0",
  "#10B981",
  "#84CC16",
  "#BEF264",
  "#F59E0B",
  "#6D4AFF",
  "#3390EC",
  "#FF9500",
  "#FF3D71",
  "#0F172A",
  "#64748B",
  "#F8FAFC",
] as const;

export type StoryTextFontId = "inter-bold" | "inter-regular" | "inter-semi" | "serif" | "mono";

export const STORY_TEXT_FONTS: { id: StoryTextFontId; label: string; fontFamily: string }[] = [
  { id: "inter-bold", label: "Gras", fontFamily: "Inter_700Bold" },
  { id: "inter-regular", label: "Normal", fontFamily: "Inter_400Regular" },
  { id: "inter-semi", label: "Semi", fontFamily: "Inter_600SemiBold" },
  {
    id: "serif",
    label: "Serif",
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }) ?? "serif",
  },
  {
    id: "mono",
    label: "Mono",
    fontFamily: Platform.select({ ios: "Courier", android: "monospace", default: "monospace" }) ?? "monospace",
  },
];

const BLOCKED_PATTERN = /<[^>]*>|javascript\s*:/i;

export function containsBlockedStoryContent(value: string): boolean {
  return BLOCKED_PATTERN.test(value);
}

/** Supprime balises HTML, schémas script et limite à 700 caractères. */
export function sanitizeStoryText(raw: string): string {
  const cleaned = raw
    .replace(/<[^>]*>/g, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, "");

  return cleaned.slice(0, STORY_TEXT_MAX_LENGTH);
}

export function storyTextColor(background: string): string {
  const light = new Set(["#F8FAFC", "#A7F3D0", "#BEF264", "#38BDF8"]);
  return light.has(background) ? "#0F172A" : "#FFFFFF";
}

export function storyTextPlaceholderColor(background: string): string {
  const fg = storyTextColor(background);
  return fg === "#FFFFFF" ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.45)";
}

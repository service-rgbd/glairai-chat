import type { ImageSourcePropType } from "react-native";

export type ChatWallpaperId =
  | "default"
  | "doodle-light"
  | "doodle-gold"
  | "slate"
  | "ocean"
  | "lavender"
  | "sand"
  | "mint"
  | "midnight"
  | "aurora"
  | "paper"
  | "mesh";

export type ChatWallpaperPalette = {
  colors: readonly [string, string, ...string[]];
  locations?: readonly [number, number, ...number[]];
  overlay?: string;
};

export type ChatWallpaperSource =
  | { kind: "none" }
  | { kind: "gradient"; light: ChatWallpaperPalette; dark: ChatWallpaperPalette }
  | {
      kind: "image";
      light: ImageSourcePropType;
      dark?: ImageSourcePropType;
      overlay?: string;
      tile?: boolean;
    };

export interface ChatWallpaperDefinition {
  id: ChatWallpaperId;
  label: string;
  source: ChatWallpaperSource;
}

export const CHAT_WALLPAPERS: ChatWallpaperDefinition[] = [
  {
    id: "default",
    label: "Doodle",
    source: {
      kind: "image",
      light: require("@/assets/images/wallpapers/chat-doodle.png"),
      tile: true,
    },
  },
  {
    id: "doodle-light",
    label: "Doodle clair",
    source: {
      kind: "image",
      light: require("@/assets/images/wallpapers/doodle-light.png"),
      tile: true,
    },
  },
  {
    id: "doodle-gold",
    label: "Doodle or",
    source: {
      kind: "image",
      light: require("@/assets/images/wallpapers/doodle-gold.png"),
      tile: true,
    },
  },
  {
    id: "slate",
    label: "Ardoise",
    source: {
      kind: "gradient",
      light: { colors: ["#E2E8F0", "#F8FAFC", "#EEF2FF"], locations: [0, 0.55, 1] },
      dark: { colors: ["#0F172A", "#111827", "#1E1B4B"], locations: [0, 0.5, 1], overlay: "rgba(0,0,0,0.08)" },
    },
  },
  {
    id: "ocean",
    label: "Océan",
    source: {
      kind: "gradient",
      light: { colors: ["#BAE6FD", "#E0F2FE", "#F0F9FF"], locations: [0, 0.45, 1] },
      dark: { colors: ["#0C4A6E", "#0F172A", "#082F49"], locations: [0, 0.55, 1], overlay: "rgba(0,0,0,0.12)" },
    },
  },
  {
    id: "lavender",
    label: "Lavande",
    source: {
      kind: "gradient",
      light: { colors: ["#DDD6FE", "#EDE9FE", "#FAF5FF"], locations: [0, 0.5, 1] },
      dark: { colors: ["#312E81", "#1E1B4B", "#0F172A"], locations: [0, 0.45, 1], overlay: "rgba(0,0,0,0.1)" },
    },
  },
  {
    id: "sand",
    label: "Sable",
    source: {
      kind: "gradient",
      light: { colors: ["#FDE68A", "#FEF3C7", "#FFFBEB"], locations: [0, 0.45, 1] },
      dark: { colors: ["#78350F", "#451A03", "#1C1917"], locations: [0, 0.5, 1], overlay: "rgba(0,0,0,0.14)" },
    },
  },
  {
    id: "mint",
    label: "Menthe",
    source: {
      kind: "gradient",
      light: { colors: ["#A7F3D0", "#D1FAE5", "#ECFDF5"], locations: [0, 0.45, 1] },
      dark: { colors: ["#064E3B", "#0F172A", "#022C22"], locations: [0, 0.55, 1], overlay: "rgba(0,0,0,0.1)" },
    },
  },
  {
    id: "midnight",
    label: "Minuit",
    source: {
      kind: "gradient",
      light: { colors: ["#CBD5E1", "#94A3B8", "#64748B"], locations: [0, 0.5, 1], overlay: "rgba(255,255,255,0.08)" },
      dark: { colors: ["#020617", "#0F172A", "#111827"], locations: [0, 0.45, 1] },
    },
  },
  {
    id: "aurora",
    label: "Aurore",
    source: {
      kind: "gradient",
      light: { colors: ["#C4B5FD", "#A5F3FC", "#FBCFE8"], locations: [0, 0.5, 1] },
      dark: { colors: ["#4C1D95", "#155E75", "#831843"], locations: [0, 0.5, 1], overlay: "rgba(0,0,0,0.18)" },
    },
  },
  {
    id: "mesh",
    label: "Mesh",
    source: {
      kind: "gradient",
      light: { colors: ["#6D4AFF", "#38BDF8", "#F8FAFC"], locations: [0, 0.42, 1], overlay: "rgba(255,255,255,0.72)" },
      dark: { colors: ["#6D4AFF", "#0EA5E9", "#0A0A0A"], locations: [0, 0.38, 1], overlay: "rgba(0,0,0,0.42)" },
    },
  },
  {
    id: "paper",
    label: "Papier",
    source: {
      kind: "image",
      light: require("@/assets/images/wallpapers/paper-light.png"),
      dark: require("@/assets/images/wallpapers/paper-dark.png"),
      overlay: "rgba(255,255,255,0.06)",
    },
  },
];

const wallpaperById = new Map(CHAT_WALLPAPERS.map((item) => [item.id, item]));

export function isChatWallpaperId(value: string): value is ChatWallpaperId {
  return wallpaperById.has(value as ChatWallpaperId);
}

export function getChatWallpaper(id: ChatWallpaperId): ChatWallpaperDefinition {
  return wallpaperById.get(id) ?? CHAT_WALLPAPERS[0]!;
}

export function getChatWallpaperStorageKey(userId: string) {
  return `@gbairai_chat_wallpaper_v1:${userId}`;
}

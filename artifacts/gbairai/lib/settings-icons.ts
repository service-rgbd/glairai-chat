import type { Ionicons } from "@expo/vector-icons";
import type { ImageSource } from "expo-image";

export const SETTINGS_ICONS = {
  profile: require("@/assets/images/settings/profile.png"),
  calls: require("@/assets/images/settings/calls.png"),
  wallpaper: require("@/assets/images/settings/wallpaper.png"),
  ringtone: require("@/assets/images/settings/ringtone.png"),
  download: require("@/assets/images/settings/download.png"),
  wifi: require("@/assets/images/settings/wifi.png"),
  vibration: require("@/assets/images/settings/vibration.png"),
  lock: require("@/assets/images/settings/lock.png"),
  bell: require("@/assets/images/settings/bell.png"),
  readReceipts: require("@/assets/images/settings/read-receipts.png"),
  lastSeen: require("@/assets/images/settings/last-seen.png"),
  textSize: require("@/assets/images/settings/text-size.png"),
  profilePhoto: require("@/assets/images/settings/profile-photo.png"),
  editProfile: require("@/assets/images/settings/edit-profile.png"),
  logout: require("@/assets/images/settings/logout.png"),
  menuGrid: require("@/assets/images/settings/menu-grid.png"),
} as const satisfies Record<string, ImageSource>;

type IonName = keyof typeof Ionicons.glyphMap;

/** Icônes vectorielles en mode sombre (blanc sur fond dark). */
export const SETTINGS_ION_ICONS: Partial<Record<keyof typeof SETTINGS_ICONS, IonName>> = {
  profile: "person-circle-outline",
  profilePhoto: "camera-outline",
  editProfile: "create-outline",
  calls: "call-outline",
  wallpaper: "image-outline",
  ringtone: "musical-notes-outline",
  download: "download-outline",
  wifi: "wifi-outline",
  vibration: "phone-portrait-outline",
  lock: "lock-closed-outline",
  bell: "notifications-outline",
  readReceipts: "checkmark-done-outline",
  lastSeen: "eye-outline",
  textSize: "text-outline",
  logout: "log-out-outline",
  menuGrid: "grid-outline",
};

export type SettingsIconKey = keyof typeof SETTINGS_ICONS;

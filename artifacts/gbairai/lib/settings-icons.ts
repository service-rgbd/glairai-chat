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

export type SettingsIconKey = keyof typeof SETTINGS_ICONS;

import { Platform } from "react-native";

/** SQLite local : iOS/Android (y compris Expo Go). Désactivé sur web. */
export function isNativeLocalDbEnabled() {
  return Platform.OS !== "web";
}

import Constants from "expo-constants";

export function isExpoGo() {
  return Constants.appOwnership === "expo";
}

/** Désactiver explicitement via EXPO_PUBLIC_DISABLE_SOCKET=true (debug uniquement). */
export function isRealtimeSocketEnabled() {
  return process.env.EXPO_PUBLIC_DISABLE_SOCKET !== "true";
}

import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export type AppNetworkStatus = "online" | "offline" | "unstable";

export function mapAppNetworkStatus(state: NetInfoState): AppNetworkStatus {
  if (!state.isConnected || state.isInternetReachable === false) {
    return "offline";
  }
  if (state.type === "cellular" && state.details?.cellularGeneration === "2g") {
    return "unstable";
  }
  return "online";
}

export function useAppNetworkStatus(enabled = true) {
  const [status, setStatus] = useState<AppNetworkStatus>("online");

  useEffect(() => {
    if (!enabled) return;

    const apply = (state: NetInfoState) => {
      setStatus(mapAppNetworkStatus(state));
    };

    void NetInfo.fetch().then(apply);
    return NetInfo.addEventListener(apply);
  }, [enabled]);

  return status;
}

export function isLikelyNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout") ||
    message.includes("connexion") ||
    message.includes("internet") ||
    message.includes("hors ligne")
  );
}

export async function refreshNetworkStatus() {
  const state = await NetInfo.fetch();
  return mapAppNetworkStatus(state);
}

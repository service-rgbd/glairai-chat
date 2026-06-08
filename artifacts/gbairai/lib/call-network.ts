import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export type CallNetworkStatus = "online" | "offline" | "unstable";

export function mapNetInfoState(state: NetInfoState): CallNetworkStatus {
  if (!state.isConnected || state.isInternetReachable === false) {
    return "offline";
  }
  if (state.type === "cellular" && state.details?.cellularGeneration === "2g") {
    return "unstable";
  }
  return "online";
}

export function useCallNetworkStatus(enabled = true) {
  const [status, setStatus] = useState<CallNetworkStatus>("online");

  useEffect(() => {
    if (!enabled) return;

    const apply = (state: NetInfoState) => {
      setStatus(mapNetInfoState(state));
    };

    void NetInfo.fetch().then(apply);
    const unsubscribe = NetInfo.addEventListener(apply);
    return unsubscribe;
  }, [enabled]);

  return status;
}

export function callNetworkLabel(status: CallNetworkStatus) {
  if (status === "offline") return "Connexion perdue";
  if (status === "unstable") return "Connexion instable";
  return "";
}

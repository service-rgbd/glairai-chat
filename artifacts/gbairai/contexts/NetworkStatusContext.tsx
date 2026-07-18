import { setOfflineMutationGuard } from "@workspace/api-client-react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { AppNetworkStatus } from "@/lib/app-network";
import { refreshNetworkStatus, useAppNetworkStatus } from "@/lib/app-network";
import {
  registerOfflineMutationHandler,
  syncNetworkGateStatus,
} from "@/lib/network-gate";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthToken } from "@/hooks/useAuthToken";

export type NetworkBannerKind = "hidden" | "offline" | "unstable" | "restored";

type NetworkStatusContextValue = {
  status: AppNetworkStatus;
  bannerKind: NetworkBannerKind;
  checking: boolean;
  isOffline: boolean;
  dismissBanner: () => void;
  showIssueBanner: () => void;
  notifyOfflineAction: () => void;
  retryConnection: () => Promise<void>;
};

const NetworkStatusContext = createContext<NetworkStatusContextValue | null>(null);

export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const authToken = useAuthToken();
  const enabled = Boolean(authToken);
  const status = useAppNetworkStatus(enabled);
  const prevStatusRef = useRef<AppNetworkStatus>(status);
  const restoredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [bannerKind, setBannerKind] = useState<NetworkBannerKind>("hidden");
  const [dismissedUntilOnline, setDismissedUntilOnline] = useState(false);
  const [checking, setChecking] = useState(false);

  const clearRestoredTimer = useCallback(() => {
    if (restoredTimerRef.current) {
      clearTimeout(restoredTimerRef.current);
      restoredTimerRef.current = null;
    }
  }, []);

  const showIssueBanner = useCallback(() => {
    setDismissedUntilOnline(false);
    clearRestoredTimer();
    setBannerKind(status === "unstable" ? "unstable" : "offline");
  }, [clearRestoredTimer, status]);

  const notifyOfflineAction = useCallback(() => {
    showIssueBanner();
  }, [showIssueBanner]);

  const dismissBanner = useCallback(() => {
    if (bannerKind === "restored") {
      setBannerKind("hidden");
      return;
    }
    setDismissedUntilOnline(true);
    setBannerKind("hidden");
  }, [bannerKind]);

  const retryConnection = useCallback(async () => {
    setChecking(true);
    try {
      const next = await refreshNetworkStatus();
      if (next === "online") {
        setDismissedUntilOnline(false);
        setBannerKind("restored");
        clearRestoredTimer();
        restoredTimerRef.current = setTimeout(() => setBannerKind("hidden"), 2800);
        return;
      }
      setBannerKind(next === "unstable" ? "unstable" : "offline");
    } finally {
      setChecking(false);
    }
  }, [clearRestoredTimer]);

  useEffect(() => {
    syncNetworkGateStatus(status);
  }, [status]);

  useEffect(() => {
    registerOfflineMutationHandler(notifyOfflineAction);
    setOfflineMutationGuard(
      () => status === "offline",
      notifyOfflineAction,
    );
    return () => {
      registerOfflineMutationHandler(null);
      setOfflineMutationGuard(null, null);
    };
  }, [notifyOfflineAction, status]);

  useEffect(() => {
    if (!enabled) {
      clearRestoredTimer();
      setBannerKind("hidden");
      setDismissedUntilOnline(false);
      prevStatusRef.current = "online";
      return;
    }

    const previous = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === "online") {
      setDismissedUntilOnline(false);
      if (previous === "offline" || previous === "unstable") {
        setBannerKind("restored");
        clearRestoredTimer();
        restoredTimerRef.current = setTimeout(() => setBannerKind("hidden"), 2800);
      } else {
        setBannerKind((current) => (current === "restored" ? current : "hidden"));
      }
      return;
    }

    if (dismissedUntilOnline) {
      setBannerKind("hidden");
      return;
    }

    clearRestoredTimer();
    setBannerKind(status === "unstable" ? "unstable" : "offline");
  }, [clearRestoredTimer, dismissedUntilOnline, enabled, status]);

  useEffect(() => () => clearRestoredTimer(), [clearRestoredTimer]);

  const value = useMemo<NetworkStatusContextValue>(
    () => ({
      status,
      bannerKind,
      checking,
      isOffline: status === "offline",
      dismissBanner,
      showIssueBanner,
      notifyOfflineAction,
      retryConnection,
    }),
    [
      bannerKind,
      checking,
      dismissBanner,
      notifyOfflineAction,
      retryConnection,
      showIssueBanner,
      status,
    ],
  );

  return <NetworkStatusContext.Provider value={value}>{children}</NetworkStatusContext.Provider>;
}

export function useNetworkStatus() {
  const context = useContext(NetworkStatusContext);
  if (!context) {
    throw new Error("useNetworkStatus doit être utilisé dans NetworkStatusProvider");
  }
  return context;
}

export function useOptionalNetworkStatus() {
  return useContext(NetworkStatusContext);
}

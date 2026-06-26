import React from "react";

import { NetworkIssueBanner } from "@/components/NetworkIssueBanner";
import { useNetworkStatus } from "@/contexts/NetworkStatusContext";
import { useAuth } from "@/contexts/AuthContext";

export function NetworkStatusBridge() {
  const { authToken } = useAuth();
  const { bannerKind, checking, dismissBanner, retryConnection } = useNetworkStatus();

  if (!authToken) {
    return null;
  }

  return (
    <NetworkIssueBanner
      kind={bannerKind}
      checking={checking}
      onRetry={() => void retryConnection()}
      onDismiss={dismissBanner}
    />
  );
}

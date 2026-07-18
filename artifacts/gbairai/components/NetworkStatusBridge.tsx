import React from "react";

import { NetworkIssueBanner } from "@/components/NetworkIssueBanner";
import { useNetworkStatus } from "@/contexts/NetworkStatusContext";
import { useAuthToken } from "@/hooks/useAuthToken";

export function NetworkStatusBridge() {
  const authToken = useAuthToken();
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

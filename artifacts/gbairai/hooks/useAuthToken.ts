import { useSyncExternalStore } from "react";

import { getAuthTokenSnapshot, subscribeAuthToken } from "@/lib/auth-token";

export function useAuthToken() {
  return useSyncExternalStore(subscribeAuthToken, getAuthTokenSnapshot, () => null);
}

import type { AppNetworkStatus } from "@/lib/app-network";

let currentStatus: AppNetworkStatus = "online";
let onBlocked: (() => void) | null = null;

export function syncNetworkGateStatus(status: AppNetworkStatus) {
  currentStatus = status;
}

export function registerOfflineMutationHandler(handler: (() => void) | null) {
  onBlocked = handler;
}

export function isMutationBlockedByNetwork() {
  return currentStatus === "offline";
}

export function notifyOfflineMutationBlocked() {
  onBlocked?.();
}

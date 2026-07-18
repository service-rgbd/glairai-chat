let authTokenSnapshot: string | null = null;
let onUnauthorized: (() => void) | null = null;
const authTokenListeners = new Set<() => void>();

function notifyAuthTokenListeners() {
  for (const listener of authTokenListeners) {
    listener();
  }
}

export function setAuthTokenSnapshot(token: string | null) {
  if (authTokenSnapshot === token) return;
  authTokenSnapshot = token;
  notifyAuthTokenListeners();
}

export function getAuthTokenSnapshot() {
  return authTokenSnapshot;
}

export function subscribeAuthToken(listener: () => void) {
  authTokenListeners.add(listener);
  return () => {
    authTokenListeners.delete(listener);
  };
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export function notifyUnauthorized() {
  onUnauthorized?.();
}

export function getMediaAuthHeaders(): Record<string, string> {
  const token = authTokenSnapshot?.trim();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export function isProtectedMediaUrl(url: string) {
  return url.includes("/api/media/public") || url.includes("/api/media/content");
}

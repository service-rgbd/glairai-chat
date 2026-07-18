let authTokenSnapshot: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthTokenSnapshot(token: string | null) {
  authTokenSnapshot = token;
}

export function getAuthTokenSnapshot() {
  return authTokenSnapshot;
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

import { getApiBaseUrl } from "./api-config";
import { getDisplayMediaUrl } from "./media";

export function resolveAvatarUrl(avatar: string | null | undefined) {
  if (!avatar?.trim()) return null;

  const trimmed = avatar.trim();

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("file://")) {
    try {
      const url = new URL(trimmed);
      if (url.pathname.endsWith("/api/media/public")) {
        const key = url.searchParams.get("key");
        if (key) {
          return `${getApiBaseUrl()}/api/media/public?key=${encodeURIComponent(key)}`;
        }
      }
    } catch {
      return trimmed;
    }
    return trimmed;
  }

  if (trimmed.startsWith("/api/media/public") || trimmed.startsWith("/channel-assets/")) {
    return `${getApiBaseUrl()}${trimmed}`;
  }

  return getDisplayMediaUrl(trimmed, null);
}

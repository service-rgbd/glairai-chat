import { getApiBaseUrl } from "./api-config";
import { getDisplayMediaUrl } from "./media";

export function resolveAvatarUrl(avatar: string | null | undefined) {
  if (!avatar?.trim()) return null;

  const trimmed = avatar.trim();

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("file://")) {
    const proxied = getDisplayMediaUrl("", trimmed);
    return proxied || trimmed;
  }

  if (trimmed.startsWith("/api/media/public") || trimmed.startsWith("/channel-assets/")) {
    return `${getApiBaseUrl()}${trimmed}`;
  }

  return getDisplayMediaUrl(trimmed, null);
}

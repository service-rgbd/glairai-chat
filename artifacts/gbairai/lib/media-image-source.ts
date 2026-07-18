import type { ImageSource } from "expo-image";

import { getMediaAuthHeaders, isProtectedMediaUrl } from "@/lib/auth-token";

export function getAuthenticatedImageSource(
  uri: string | null | undefined,
): ImageSource | null {
  if (!uri?.trim()) return null;
  if (!isProtectedMediaUrl(uri)) {
    return { uri };
  }
  return {
    uri,
    headers: getMediaAuthHeaders(),
  };
}

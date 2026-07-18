import { useEffect, useState } from "react";

import { getMediaAuthHeaders, isProtectedMediaUrl } from "@/lib/auth-token";
import { peekCachedMediaUri, resolveCachedMediaUri } from "@/lib/media-cache";

export function useCachedMediaUrl(remoteUrl: string | null | undefined) {
  const [uri, setUri] = useState<string | null>(() => peekCachedMediaUri(remoteUrl));

  useEffect(() => {
    if (!remoteUrl?.trim()) {
      setUri(null);
      return;
    }

    const trimmed = remoteUrl.trim();
    const cached = peekCachedMediaUri(trimmed);
    if (cached) {
      setUri(cached);
      return;
    }

    if (!isProtectedMediaUrl(trimmed)) {
      setUri(trimmed);
      return;
    }

    setUri(null);
    let cancelled = false;

    void resolveCachedMediaUri(trimmed)
      .then((resolved) => {
        if (!cancelled && resolved) {
          setUri(resolved);
        }
      })
      .catch(() => {
        if (!cancelled && getMediaAuthHeaders().Authorization) {
          setUri(trimmed);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [remoteUrl]);

  return uri;
}

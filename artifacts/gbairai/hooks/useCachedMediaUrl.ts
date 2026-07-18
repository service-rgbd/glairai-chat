import { useEffect, useState } from "react";

import { getMediaAuthHeaders, isProtectedMediaUrl } from "@/lib/auth-token";
import { peekCachedMediaUri, resolveCachedMediaUri } from "@/lib/media-cache";
import { shouldResolveMediaToDisk } from "@/lib/media-cache-policy";

export function useCachedMediaUrl(remoteUrl: string | null | undefined) {
  const [uri, setUri] = useState<string | null>(() => peekCachedMediaUri(remoteUrl));

  useEffect(() => {
    if (!remoteUrl?.trim()) {
      setUri(null);
      return;
    }

    const cached = peekCachedMediaUri(remoteUrl);
    if (cached) {
      setUri(cached);
      return;
    }

    if (!isProtectedMediaUrl(remoteUrl)) {
      setUri(remoteUrl);
    } else {
      setUri(null);
    }

    if (!shouldResolveMediaToDisk()) {
      if (isProtectedMediaUrl(remoteUrl)) {
        setUri(remoteUrl);
      }
      return;
    }

    let cancelled = false;

    void resolveCachedMediaUri(remoteUrl)
      .then((resolved) => {
        if (!cancelled && resolved) {
          setUri(resolved);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUri(remoteUrl);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [remoteUrl]);

  return uri;
}

import { useEffect, useState } from "react";

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

    setUri(remoteUrl);
    if (!shouldResolveMediaToDisk()) {
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

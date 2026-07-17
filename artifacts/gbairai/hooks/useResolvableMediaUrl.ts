import { useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { getDisplayMediaUrl, isStableDisplayUrl, resolveMediaUrl } from "@/lib/media";

export function useResolvableMediaUrl(key?: string | null, url?: string | null) {
  const { authToken } = useAuth();
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!key?.trim()) {
      setResolvedUrl(null);
      return;
    }

    const proxyUrl = getDisplayMediaUrl(key, url);
    if (url?.trim() && isStableDisplayUrl(url)) {
      setResolvedUrl(url.trim());
      return;
    }

    setResolvedUrl(proxyUrl);
    if (!authToken) {
      return;
    }

    let cancelled = false;
    void resolveMediaUrl(authToken, key)
      .then((directUrl) => {
        if (!cancelled && directUrl?.trim() && isStableDisplayUrl(directUrl)) {
          setResolvedUrl(directUrl.trim());
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedUrl(proxyUrl);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authToken, key, url]);

  return resolvedUrl;
}

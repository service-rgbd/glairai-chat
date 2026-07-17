import { useEffect, useState } from "react";

import { getDisplayMediaUrl } from "@/lib/media";

export function useResolvableMediaUrl(key?: string | null, url?: string | null) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!key?.trim()) {
      setResolvedUrl(null);
      return;
    }

    setResolvedUrl(getDisplayMediaUrl(key, url));
  }, [key, url]);

  return resolvedUrl;
}

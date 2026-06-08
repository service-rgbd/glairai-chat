import React, { useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { afterAuthNativeDelay, INCOMING_OVERLAY_DELAY_MS } from "@/lib/post-auth-native-delay";

/** Overlay appels entrants — monté après stabilisation post-login. */
export function AuthenticatedIncomingCallOverlay() {
  const { isAuthenticated } = useAuth();
  const [Overlay, setOverlay] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setOverlay(null);
      return;
    }

    let active = true;
    const cancelDelay = afterAuthNativeDelay(() => {
      void import("@/components/IncomingCallOverlay").then((mod) => {
        if (active) {
          setOverlay(() => mod.IncomingCallOverlay);
        }
      });
    }, INCOMING_OVERLAY_DELAY_MS);

    return () => {
      active = false;
      cancelDelay();
    };
  }, [isAuthenticated]);

  if (!Overlay) return null;
  return <Overlay />;
}

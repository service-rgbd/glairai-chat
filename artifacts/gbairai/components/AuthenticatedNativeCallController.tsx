import React, { useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { afterAuthNativeDelay } from "@/lib/post-auth-native-delay";

/** CallKit / VoIP — chargement différé après stabilisation post-login. */
export function AuthenticatedNativeCallController() {
  const { isAuthenticated } = useAuth();
  const [Controller, setController] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setController(null);
      return;
    }

    let active = true;
    const cancelDelay = afterAuthNativeDelay(() => {
      void import("@/components/NativeCallController").then((mod) => {
        if (active) {
          setController(() => mod.NativeCallController);
        }
      });
    });

    return () => {
      active = false;
      cancelDelay();
    };
  }, [isAuthenticated]);

  if (!Controller) return null;
  return <Controller />;
}

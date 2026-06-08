import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { safeGetItem, safeSetItem } from "@/lib/safe-storage";

export type CallRingtoneId = "classic" | "soft" | "bright";

export const CALL_RINGTONES: Array<{ id: CallRingtoneId; label: string }> = [
  { id: "classic", label: "Classique" },
  { id: "soft", label: "Douce" },
  { id: "bright", label: "Vive" },
];

const STORAGE_KEY = "@gbairai_call_ringtone_v1";

export function getCallRingtoneAsset(id: CallRingtoneId, variant: "incoming" | "outgoing") {
  if (variant === "outgoing") {
    return require("@/assets/sounds/ringback.wav");
  }

  switch (id) {
    case "soft":
      return require("@/assets/sounds/connect.wav");
    case "bright":
      return require("@/assets/sounds/incoming.wav");
    case "classic":
    default:
      return require("@/assets/sounds/incoming.wav");
  }
}

export function useCallRingtone() {
  const { currentUser } = useAuth();
  const [ringtoneId, setRingtoneIdState] = useState<CallRingtoneId>("classic");

  useEffect(() => {
    let cancelled = false;
    const key = currentUser?.id ? `${STORAGE_KEY}:${currentUser.id}` : STORAGE_KEY;

    void safeGetItem(key).then((stored) => {
      if (cancelled) return;
      if (stored === "soft" || stored === "bright" || stored === "classic") {
        setRingtoneIdState(stored);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const setRingtoneId = useCallback(
    async (nextId: CallRingtoneId) => {
      setRingtoneIdState(nextId);
      const key = currentUser?.id ? `${STORAGE_KEY}:${currentUser.id}` : STORAGE_KEY;
      await safeSetItem(key, nextId);
    },
    [currentUser?.id],
  );

  const ringtone = CALL_RINGTONES.find((item) => item.id === ringtoneId) ?? CALL_RINGTONES[0]!;

  return { ringtoneId, ringtone, setRingtoneId, ringtones: CALL_RINGTONES };
}

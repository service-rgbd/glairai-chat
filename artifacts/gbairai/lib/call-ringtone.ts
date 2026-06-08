import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { safeGetItem, safeRemoveItem, safeSetItem } from "@/lib/safe-storage";

export type CallRingtonePresetId = "classic" | "soft" | "bright";

export type CallRingtoneSelection =
  | { kind: "preset"; id: CallRingtonePresetId }
  | { kind: "custom"; uri: string; name: string };

export const CALL_RINGTONES: Array<{ id: CallRingtonePresetId; label: string }> = [
  { id: "classic", label: "Classique" },
  { id: "soft", label: "Douce" },
  { id: "bright", label: "Vive" },
];

const STORAGE_KEY = "@gbairai_call_ringtone_v2";

function storageKeyForUser(userId?: string | null) {
  return userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
}

function parseStoredSelection(raw: string | null): CallRingtoneSelection | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CallRingtoneSelection;
    if (parsed.kind === "custom" && parsed.uri?.trim()) {
      return { kind: "custom", uri: parsed.uri, name: parsed.name?.trim() || "Son perso" };
    }
    if (parsed.kind === "preset" && CALL_RINGTONES.some((item) => item.id === parsed.id)) {
      return parsed;
    }
  } catch {
    // Legacy plain string below.
  }
  if (raw === "soft" || raw === "bright" || raw === "classic") {
    return { kind: "preset", id: raw };
  }
  return null;
}

export function getCallRingtoneLabel(selection: CallRingtoneSelection) {
  if (selection.kind === "custom") {
    return selection.name;
  }
  return CALL_RINGTONES.find((item) => item.id === selection.id)?.label ?? "Classique";
}

export function getCallRingtoneSource(
  selection: CallRingtoneSelection,
  variant: "incoming" | "outgoing",
): number | { uri: string } {
  if (variant === "outgoing") {
    return require("@/assets/sounds/ringback.wav");
  }

  if (selection.kind === "custom") {
    return { uri: selection.uri };
  }

  switch (selection.id) {
    case "soft":
      return require("@/assets/sounds/connect.wav");
    case "bright":
      return require("@/assets/sounds/incoming.wav");
    case "classic":
    default:
      return require("@/assets/sounds/incoming.wav");
  }
}

/** @deprecated Utiliser getCallRingtoneSource avec CallRingtoneSelection */
export function getCallRingtoneAsset(id: CallRingtonePresetId, variant: "incoming" | "outgoing") {
  return getCallRingtoneSource({ kind: "preset", id }, variant);
}

export function useCallRingtone() {
  const { currentUser } = useAuth();
  const [selection, setSelectionState] = useState<CallRingtoneSelection>({
    kind: "preset",
    id: "classic",
  });

  useEffect(() => {
    let cancelled = false;
    const key = storageKeyForUser(currentUser?.id);

    void safeGetItem(key).then((stored) => {
      if (cancelled) return;
      const parsed = parseStoredSelection(stored);
      if (parsed) {
        setSelectionState(parsed);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const persistSelection = useCallback(
    async (next: CallRingtoneSelection) => {
      setSelectionState(next);
      const key = storageKeyForUser(currentUser?.id);
      await safeSetItem(key, JSON.stringify(next));
    },
    [currentUser?.id],
  );

  const setPresetRingtone = useCallback(
    async (id: CallRingtonePresetId) => {
      await persistSelection({ kind: "preset", id });
    },
    [persistSelection],
  );

  const setCustomRingtone = useCallback(
    async (uri: string, name: string) => {
      await persistSelection({ kind: "custom", uri, name: name.trim() || "Son perso" });
    },
    [persistSelection],
  );

  const clearCustomRingtone = useCallback(async () => {
    await persistSelection({ kind: "preset", id: "classic" });
  }, [persistSelection]);

  const label = getCallRingtoneLabel(selection);

  return {
    selection,
    label,
    ringtoneId: selection.kind === "preset" ? selection.id : ("custom" as const),
    setPresetRingtone,
    setCustomRingtone,
    clearCustomRingtone,
    ringtones: CALL_RINGTONES,
  };
}

export async function migrateLegacyRingtoneStorage(userId?: string | null) {
  const key = storageKeyForUser(userId);
  const stored = await safeGetItem(key);
  if (!stored || stored.startsWith("{")) return;
  const parsed = parseStoredSelection(stored);
  if (parsed) {
    await safeSetItem(key, JSON.stringify(parsed));
  } else {
    await safeRemoveItem(key);
  }
}

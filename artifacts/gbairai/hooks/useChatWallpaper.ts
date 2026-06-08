import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import {
  CHAT_WALLPAPERS,
  getChatWallpaper,
  getChatWallpaperStorageKey,
  isChatWallpaperId,
  type ChatWallpaperId,
} from "@/lib/chat-wallpapers";
import { safeGetItem, safeSetItem } from "@/lib/safe-storage";

export function useChatWallpaper() {
  const { currentUser } = useAuth();
  const [wallpaperId, setWallpaperIdState] = useState<ChatWallpaperId>("default");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!currentUser?.id) {
        setWallpaperIdState("default");
        setIsReady(true);
        return;
      }

      const stored = await safeGetItem(getChatWallpaperStorageKey(currentUser.id));
      if (!cancelled) {
        setWallpaperIdState(stored && isChatWallpaperId(stored) ? stored : "default");
        setIsReady(true);
      }
    };

    setIsReady(false);
    void load();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const setWallpaperId = useCallback(
    async (nextId: ChatWallpaperId) => {
      setWallpaperIdState(nextId);
      if (!currentUser?.id) return;
      await safeSetItem(getChatWallpaperStorageKey(currentUser.id), nextId);
    },
    [currentUser?.id],
  );

  return {
    wallpaperId,
    wallpaper: getChatWallpaper(wallpaperId),
    wallpapers: CHAT_WALLPAPERS,
    setWallpaperId,
    isReady,
  };
}

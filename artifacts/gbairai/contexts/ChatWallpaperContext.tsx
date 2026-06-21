import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/contexts/AuthContext";
import {
  CHAT_WALLPAPERS,
  getChatWallpaper,
  getChatWallpaperStorageKey,
  isChatWallpaperId,
  type ChatWallpaperId,
} from "@/lib/chat-wallpapers";
import { safeGetItem, safeSetItem } from "@/lib/safe-storage";

type ChatWallpaperContextValue = {
  wallpaperId: ChatWallpaperId;
  wallpaper: ReturnType<typeof getChatWallpaper>;
  wallpapers: typeof CHAT_WALLPAPERS;
  setWallpaperId: (nextId: ChatWallpaperId) => Promise<void>;
  isReady: boolean;
};

const ChatWallpaperContext = createContext<ChatWallpaperContextValue | null>(null);

export function ChatWallpaperProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [wallpaperId, setWallpaperIdState] = useState<ChatWallpaperId>("default");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!currentUser?.id) {
        if (!cancelled) {
          setWallpaperIdState("default");
          setIsReady(true);
        }
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

  const value = useMemo(
    () => ({
      wallpaperId,
      wallpaper: getChatWallpaper(wallpaperId),
      wallpapers: CHAT_WALLPAPERS,
      setWallpaperId,
      isReady,
    }),
    [isReady, setWallpaperId, wallpaperId],
  );

  return <ChatWallpaperContext.Provider value={value}>{children}</ChatWallpaperContext.Provider>;
}

export function useChatWallpaper() {
  const context = useContext(ChatWallpaperContext);
  if (!context) {
    throw new Error("useChatWallpaper doit être utilisé dans ChatWallpaperProvider");
  }
  return context;
}

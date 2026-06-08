import { useAuth } from "@/contexts/AuthContext";

export function useChatFontScale() {
  const { currentUser } = useAuth();
  const scale = currentUser?.settings.chatFontScale ?? "medium";

  return {
    scale,
    messageFontSize: scale === "small" ? 14 : scale === "large" ? 17 : 15.5,
    metaFontSize: scale === "small" ? 11 : scale === "large" ? 13 : 12,
  };
}

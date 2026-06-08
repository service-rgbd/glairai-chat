import type { GMessage } from "@/contexts/chats-types";
import { isCallMessageContent } from "@/lib/call-messages";

export const MESSAGE_ACTION_WINDOW_MS = 15 * 60_000;

export function getMessageActionAvailability(message: GMessage, currentUserId: string) {
  if (message.type === "text" && isCallMessageContent(message.content)) {
    return { canEdit: false, canDelete: false, isWithinWindow: false };
  }
  if (message.senderId !== currentUserId) {
    return { canEdit: false, canDelete: false, isWithinWindow: false };
  }

  if (message.status === "sending" || message.status === "failed" || message.id.startsWith("local_")) {
    return { canEdit: false, canDelete: false, isWithinWindow: false };
  }

  const elapsedMs = Date.now() - new Date(message.timestamp).getTime();
  const isWithinWindow = elapsedMs <= MESSAGE_ACTION_WINDOW_MS;

  return {
    canEdit: isWithinWindow && message.type === "text",
    canDelete: isWithinWindow,
    isWithinWindow,
  };
}

export function getDeleteMessageLabel(type: GMessage["type"]) {
  switch (type) {
    case "image":
      return "Supprimer la photo";
    case "video":
      return "Supprimer la vidéo";
    case "audio":
      return "Supprimer le vocal";
    default:
      return "Supprimer le message";
  }
}

export function getDeleteMessageTitle(type: GMessage["type"]) {
  switch (type) {
    case "image":
      return "Supprimer cette photo ?";
    case "video":
      return "Supprimer cette vidéo ?";
    case "audio":
      return "Supprimer ce vocal ?";
    default:
      return "Supprimer ce message ?";
  }
}

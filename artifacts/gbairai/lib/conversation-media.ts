import type { GMessage } from "@/contexts/chats-types";
import {
  getDisplayMediaUrl,
  parseImageMessagePayload,
  parseVideoMessagePayload,
} from "@/lib/media";

export type ConversationMediaItem = {
  messageId: string;
  type: "image" | "video";
  url: string;
  key: string;
  mimeType: string;
  timestamp: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  thumbnailKey?: string;
  thumbnailUrl?: string;
};

export function collectConversationMedia(messages: GMessage[]): ConversationMediaItem[] {
  const items: ConversationMediaItem[] = [];

  for (const message of messages) {
    if (message.isDeleted) continue;

    if (message.type === "image") {
      const payload = parseImageMessagePayload(message.content);
      if (!payload || payload.viewOnce) continue;
      const url = getDisplayMediaUrl(payload.key, payload.url);
      if (!url) continue;
      items.push({
        messageId: message.id,
        type: "image",
        url,
        key: payload.key,
        mimeType: payload.mimeType,
        timestamp: message.timestamp,
        width: payload.width,
        height: payload.height,
      });
      continue;
    }

    if (message.type === "video") {
      const payload = parseVideoMessagePayload(message.content);
      if (!payload) continue;
      const url = getDisplayMediaUrl(payload.key, payload.url);
      if (!url) continue;
      items.push({
        messageId: message.id,
        type: "video",
        url,
        key: payload.key,
        mimeType: payload.mimeType,
        timestamp: message.timestamp,
        durationSeconds: payload.durationSeconds,
        thumbnailKey: payload.thumbnailKey,
        thumbnailUrl: payload.thumbnailUrl
          ? getDisplayMediaUrl(payload.thumbnailKey ?? "", payload.thumbnailUrl)
          : undefined,
      });
    }
  }

  return items.sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

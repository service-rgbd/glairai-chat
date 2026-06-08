import type { ConversationMessage, ConversationSummary } from "@workspace/api-client-react";

import { resolveAvatarUrl } from "@/lib/avatar";
import { getDisplayMediaUrl, parseImageMessagePayload, parseVideoMessagePayload } from "@/lib/media";
import { prefetchMediaUri } from "@/lib/media-cache";
import { shouldPrefetchMedia } from "@/lib/media-cache-policy";

const MAX_MESSAGES_PER_CHAT = 12;
const MAX_CHATS = 24;

function collectMessageMediaUrls(messages: ConversationMessage[]) {
  const urls = new Set<string>();

  for (const message of messages.slice(-MAX_MESSAGES_PER_CHAT)) {
    if (message.type === "image") {
      const payload = parseImageMessagePayload(message.content);
      const url = payload ? getDisplayMediaUrl(payload.key, payload.url) : null;
      if (url) urls.add(url);
      continue;
    }

    if (message.type === "video") {
      const payload = parseVideoMessagePayload(message.content);
      if (!payload) continue;
      const thumb = getDisplayMediaUrl(payload.thumbnailKey ?? "", payload.thumbnailUrl);
      if (thumb) urls.add(thumb);
    }
  }

  return urls;
}

export async function prefetchConversationListMedia(
  conversations: ConversationSummary[],
  messagesByChatId: Record<string, ConversationMessage[]>,
) {
  if (!shouldPrefetchMedia() || conversations.length === 0) {
    return;
  }

  const urls = new Set<string>();
  const limited = conversations.slice(0, MAX_CHATS);

  for (const conversation of limited) {
    for (const participant of conversation.participants) {
      const avatar = resolveAvatarUrl(participant.profile.avatarUrl);
      if (avatar) urls.add(avatar);
    }

    for (const url of collectMessageMediaUrls(messagesByChatId[conversation.id] ?? [])) {
      urls.add(url);
    }
  }

  await Promise.all(
    Array.from(urls)
      .slice(0, 80)
      .map((url) => prefetchMediaUri(url)),
  );
}

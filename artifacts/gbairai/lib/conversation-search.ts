import type { GMessage } from "@/contexts/chats-types";
import { isCallMessageContent } from "@/lib/call-messages";
import { getEmoji3dPayloadFromContent } from "@/lib/emoji-messages";
import { getMessageDisplayContent } from "@/lib/message-meta";

export type ConversationSearchFilter = "all" | "text" | "image" | "video" | "audio";

export interface ConversationSearchResult {
  message: GMessage;
  title: string;
  subtitle: string;
}

function getMessageSearchText(message: GMessage) {
  if (message.isDeleted) {
    return "";
  }

  if (message.type === "text") {
    if (isCallMessageContent(message.content)) {
      return "";
    }
    const emoji = getEmoji3dPayloadFromContent(message.content);
    if (emoji) {
      return emoji.emoji;
    }
    return getMessageDisplayContent(message.content).displayContent;
  }

  return "";
}

function getMessageTitle(message: GMessage) {
  switch (message.type) {
    case "image":
      return "Photo";
    case "video":
      return "Vidéo";
    case "audio":
      return "Note vocale";
    default:
      return getMessageSearchText(message) || "Message";
  }
}

function getMessageSubtitle(message: GMessage) {
  const time = new Date(message.timestamp).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (message.type === "text") {
    const text = getMessageSearchText(message);
    return text ? `${time} · ${text}` : time;
  }

  return time;
}

function matchesFilter(message: GMessage, filter: ConversationSearchFilter) {
  if (filter === "all") {
    return true;
  }
  if (filter === "text") {
    return message.type === "text" && !message.isDeleted && !isCallMessageContent(message.content);
  }
  return message.type === filter;
}

export function searchConversationMessages(
  messages: GMessage[],
  query: string,
  filter: ConversationSearchFilter = "all",
) {
  const normalizedQuery = query.trim().toLowerCase();
  const results: ConversationSearchResult[] = [];

  for (const message of messages) {
    if (message.isDeleted) {
      continue;
    }
    if (!matchesFilter(message, filter)) {
      continue;
    }

    if (message.type !== "text") {
      const haystack = `${getMessageTitle(message)} ${message.type}`.toLowerCase();
      if (!normalizedQuery || haystack.includes(normalizedQuery)) {
        results.push({
          message,
          title: getMessageTitle(message),
          subtitle: getMessageSubtitle(message),
        });
      }
      continue;
    }

    if (isCallMessageContent(message.content)) {
      continue;
    }

    const searchable = getMessageSearchText(message).toLowerCase();
    if (!normalizedQuery) {
      continue;
    }
    if (searchable.includes(normalizedQuery)) {
      results.push({
        message,
        title: getMessageTitle(message),
        subtitle: getMessageSubtitle(message),
      });
    }
  }

  return results.sort((left, right) => right.message.timestamp.localeCompare(left.message.timestamp));
}

import type { QueryClient } from "@tanstack/react-query";
import type { ConversationMessage, ConversationSummary } from "@workspace/api-client-react";

import {
  clearLocalDb,
  deleteMessage as deleteLocalMessage,
  initLocalDb,
  listConversations,
  listMessages,
  upsertConversations,
  upsertMessages,
} from "./local-db";
import { isNativeLocalDbEnabled } from "./local-cache-enabled";

type ConversationsPage = { conversations: ConversationSummary[] };
type MessagesPage = { messages: ConversationMessage[]; nextCursor: string | null };

export async function hydrateChatCacheFromLocalDb(
  queryClient: QueryClient,
  loadedConversationIds: string[],
) {
  if (!isNativeLocalDbEnabled()) {
    return { conversationsCount: 0 };
  }

  try {
    await initLocalDb();

    const conversations = await listConversations();
    if (conversations.length > 0) {
      queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => {
        if (current?.conversations?.length) {
          return current;
        }
        return { conversations };
      });
    }

    for (const chatId of loadedConversationIds) {
      const messages = await listMessages(chatId);
      if (messages.length === 0) continue;

      queryClient.setQueryData<MessagesPage>(["messages", chatId], (current) => {
        if (current?.messages?.length) {
          return current;
        }
        return { messages, nextCursor: null };
      });
    }

    return { conversationsCount: conversations.length };
  } catch {
    await clearLocalDb();
    return { conversationsCount: 0 };
  }
}

export async function persistConversationsToLocalDb(conversations: ConversationSummary[]) {
  if (!isNativeLocalDbEnabled() || conversations.length === 0) return;
  try {
    await upsertConversations(conversations);
  } catch {
    // Cache local best-effort: ne jamais faire crasher l'app.
  }
}

export async function persistMessagesToLocalDb(
  conversationId: string,
  messages: ConversationMessage[],
) {
  if (!isNativeLocalDbEnabled() || messages.length === 0) return;
  try {
    await upsertMessages(conversationId, messages);
  } catch {
    // Cache local best-effort: ne jamais faire crasher l'app.
  }
}

export async function removeMessageFromLocalDb(messageId: string) {
  await deleteLocalMessage(messageId);
}

export async function clearLocalChatCache() {
  if (!isNativeLocalDbEnabled()) return;
  await clearLocalDb();
}

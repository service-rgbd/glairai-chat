import type { ConversationMessage, ConversationSummary } from "@workspace/api-client-react";

import { isNativeLocalDbEnabled } from "./local-cache-enabled";

type LocalDbModule = typeof import("./local-db.impl");

let implPromise: Promise<LocalDbModule | null> | null = null;

async function loadImpl() {
  if (!isNativeLocalDbEnabled()) {
    return null;
  }

  if (!implPromise) {
    implPromise = import("./local-db.impl");
  }

  return implPromise;
}

export async function initLocalDb() {
  const impl = await loadImpl();
  return impl?.initLocalDb() ?? null;
}

export async function upsertConversations(conversations: ConversationSummary[]) {
  const impl = await loadImpl();
  if (!impl || conversations.length === 0) return;
  await impl.upsertConversations(conversations);
}

export async function listConversations() {
  const impl = await loadImpl();
  if (!impl) return [] as ConversationSummary[];
  return impl.listConversations();
}

export async function upsertMessages(conversationId: string, messages: ConversationMessage[]) {
  const impl = await loadImpl();
  if (!impl || messages.length === 0) return;
  await impl.upsertMessages(conversationId, messages);
}

export async function listMessages(conversationId: string, limit = 500) {
  const impl = await loadImpl();
  if (!impl) return [] as ConversationMessage[];
  return impl.listMessages(conversationId, limit);
}

export async function deleteMessage(messageId: string) {
  const impl = await loadImpl();
  if (!impl) return;
  await impl.deleteMessage(messageId);
}

export async function clearLocalDb() {
  const impl = await loadImpl();
  if (!impl) return;
  await impl.clearLocalDb();
}

export async function getLocalDbStats() {
  const impl = await loadImpl();
  if (!impl) {
    return { conversations: 0, messages: 0 };
  }
  return impl.getLocalDbStats();
}

import { db, conversationMembersTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

import { extractMediaStorageKey } from "./media-service";

const MEDIA_KEY_PREFIX = /^(chat-media|stories|avatars|voice-notes)\//;

export function parseMediaKey(key: string) {
  const normalized = extractMediaStorageKey(key) ?? key.trim();
  if (!MEDIA_KEY_PREFIX.test(normalized)) {
    return null;
  }

  const parts = normalized.split("/");
  if (normalized.startsWith("avatars/")) {
    return { kind: "avatar" as const, ownerUserId: parts[1] ?? "" };
  }
  if (normalized.startsWith("chat-media/")) {
    return {
      kind: "chat" as const,
      conversationId: parts[1] ?? "",
      uploaderUserId: parts[2] ?? "",
    };
  }
  if (normalized.startsWith("voice-notes/")) {
    return { kind: "voice" as const, ownerUserId: parts[1] ?? "" };
  }
  if (normalized.startsWith("stories/")) {
    return { kind: "story" as const, ownerUserId: parts[1] ?? "" };
  }
  return null;
}

async function usersShareConversation(userA: string, userB: string) {
  if (!db) return userA === userB;
  if (userA === userB) return true;

  const memberships = await db
    .select({ conversationId: conversationMembersTable.conversationId })
    .from(conversationMembersTable)
    .where(eq(conversationMembersTable.userId, userA));

  const conversationIds = memberships.map((row) => row.conversationId);
  if (!conversationIds.length) return false;

  const [shared] = await db
    .select({ conversationId: conversationMembersTable.conversationId })
    .from(conversationMembersTable)
    .where(
      and(
        eq(conversationMembersTable.userId, userB),
        inArray(conversationMembersTable.conversationId, conversationIds),
      ),
    )
    .limit(1);

  return Boolean(shared);
}

export async function assertUserCanAccessMediaKey(userId: string, key: string) {
  const parsed = parseMediaKey(key);
  if (!parsed) {
    throw new Error("Clé média invalide");
  }

  if (parsed.kind === "avatar" || parsed.kind === "voice" || parsed.kind === "story") {
    if (!parsed.ownerUserId) {
      throw new Error("Clé média invalide");
    }
    if (parsed.ownerUserId === userId) return;
    if (await usersShareConversation(userId, parsed.ownerUserId)) return;
    throw new Error("Accès média non autorisé");
  }

  if (!parsed.conversationId || parsed.conversationId === "shared") {
    if (parsed.uploaderUserId === userId) return;
    throw new Error("Accès média non autorisé");
  }

  const [membership] = await db!
    .select({ userId: conversationMembersTable.userId })
    .from(conversationMembersTable)
    .where(
      and(
        eq(conversationMembersTable.conversationId, parsed.conversationId),
        eq(conversationMembersTable.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new Error("Accès média non autorisé");
  }
}

export async function assertUserCanUploadToConversation(
  userId: string,
  conversationId: string | undefined,
) {
  if (!conversationId?.trim()) return;
  const [membership] = await db!
    .select({ userId: conversationMembersTable.userId })
    .from(conversationMembersTable)
    .where(
      and(
        eq(conversationMembersTable.conversationId, conversationId),
        eq(conversationMembersTable.userId, userId),
      ),
    )
    .limit(1);
  if (!membership) {
    throw new Error("Conversation introuvable");
  }
}

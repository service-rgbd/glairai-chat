import { clearLocalChatCache } from "@/lib/chat-local-sync";
import { clearMediaCache } from "@/lib/media-cache";
import { QUERY_CACHE_KEY, queryClient } from "@/lib/query-client";
import { createGbairaiQueryPersister } from "@/lib/query-persist";
import { safeGetItem, safeRemoveItem, safeSetItem } from "@/lib/safe-storage";

export const LAST_CACHE_OWNER_KEY = "@gbairai_last_cache_user";

/** Clés AsyncStorage isolées par utilisateur (évite les fuites entre comptes). */
export const UserCacheKeys = {
  outbox: (userId: string) => `@gbairai_outbox:${userId}`,
  calls: (userId: string) => `@gbairai_calls:${userId}`,
  callsLastSeenAt: (userId: string) => `@gbairai_calls_last_seen:${userId}`,
  composeContacts: (userId: string) => `@gbairai_compose_contacts:${userId}`,
  loadedConversations: (userId: string) => `@gbairai_loaded_conversations:${userId}`,
};

/** Anciennes clés globales — migrées puis supprimées au premier chargement. */
const LEGACY_KEYS = [
  "@gbairai_outbox",
  "@gbairai_calls",
  "@gbairai_compose_contacts_cache",
  "@gbairai_loaded_conversations",
] as const;

export async function migrateLegacyUserCache(userId: string) {
  const migrations = [
    { legacy: "@gbairai_outbox", next: UserCacheKeys.outbox(userId) },
    { legacy: "@gbairai_calls", next: UserCacheKeys.calls(userId) },
    { legacy: "@gbairai_compose_contacts_cache", next: UserCacheKeys.composeContacts(userId) },
    { legacy: "@gbairai_loaded_conversations", next: UserCacheKeys.loadedConversations(userId) },
  ];

  await Promise.all(
    migrations.map(async ({ legacy, next }) => {
      const existing = await safeGetItem(next);
      if (existing) return;
      const legacyValue = await safeGetItem(legacy);
      if (!legacyValue) return;
      await safeSetItem(next, legacyValue);
      await safeRemoveItem(legacy);
    }),
  );

  await Promise.all(LEGACY_KEYS.map((key) => safeRemoveItem(key)));
}

/** Supprime le cache hors-ligne d'un utilisateur (changement de compte ou action manuelle). */
export async function purgeOfflineCacheForUser(userId: string) {
  await createGbairaiQueryPersister(userId).removeClient();

  await Promise.all([
    safeRemoveItem(`${QUERY_CACHE_KEY}:${userId}`),
    safeRemoveItem(UserCacheKeys.outbox(userId)),
    safeRemoveItem(UserCacheKeys.calls(userId)),
    safeRemoveItem(UserCacheKeys.callsLastSeenAt(userId)),
    safeRemoveItem(UserCacheKeys.composeContacts(userId)),
    safeRemoveItem(UserCacheKeys.loadedConversations(userId)),
    clearLocalChatCache(),
    clearMediaCache(),
  ]);
}

/** Au login : purge l'ancien compte si différent, conserve le cache du même utilisateur. */
export async function ensureCacheOwner(userId: string) {
  const previous = await safeGetItem(LAST_CACHE_OWNER_KEY);

  if (previous && previous !== userId) {
    await purgeOfflineCacheForUser(previous);
    queryClient.clear();
  }

  await migrateLegacyUserCache(userId);
  await safeSetItem(LAST_CACHE_OWNER_KEY, userId);
}

export function hasWarmConversationCache() {
  return queryClient.getQueryData(["conversations"]) !== undefined;
}

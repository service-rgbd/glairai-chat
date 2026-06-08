import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

import {
  QUERY_CACHE_KEY,
  QUERY_PERSIST_MAX_AGE_MS,
} from "@/lib/query-client";
import { safeGetItem, safeRemoveItem, safeSetItem } from "@/lib/safe-storage";

function storageKeyForUser(userId: string | null) {
  return userId ? `${QUERY_CACHE_KEY}:${userId}` : QUERY_CACHE_KEY;
}

export function shouldPersistQueryKey(queryKey: readonly unknown[]) {
  const root = queryKey[0];
  return root === "conversations" || root === "messages" || root === "stories";
}

export function createGbairaiQueryPersister(userId: string | null): Persister {
  const storageKey = storageKeyForUser(userId);

  return {
    persistClient: async (client: PersistedClient) => {
      await safeSetItem(storageKey, JSON.stringify(client));
    },
    restoreClient: async () => {
      const raw = await safeGetItem(storageKey);
      if (!raw) return undefined;
      try {
        return JSON.parse(raw) as PersistedClient;
      } catch {
        await safeRemoveItem(storageKey);
        return undefined;
      }
    },
    removeClient: async () => {
      await safeRemoveItem(storageKey);
    },
  };
}

export { QUERY_PERSIST_MAX_AGE_MS };

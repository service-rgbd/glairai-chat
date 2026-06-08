import { QueryClient } from "@tanstack/react-query";

import { safeRemoveItem } from "@/lib/safe-storage";

export const QUERY_CACHE_KEY = "@gbairai_query_cache_v2";
export const QUERY_PERSIST_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: QUERY_PERSIST_MAX_AGE_MS,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

export async function clearQueryCache(userId?: string | null) {
  queryClient.clear();
  await safeRemoveItem(QUERY_CACHE_KEY);
  if (userId) {
    await safeRemoveItem(`${QUERY_CACHE_KEY}:${userId}`);
  }
}

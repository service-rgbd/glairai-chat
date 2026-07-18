import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { QueryHydrationProvider } from "@/contexts/QueryHydrationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthToken } from "@/hooks/useAuthToken";
import { useColors } from "@/hooks/useColors";
import { hasWarmConversationCache } from "@/lib/offline-cache";
import { queryClient } from "@/lib/query-client";
import {
  createGbairaiQueryPersister,
  QUERY_PERSIST_MAX_AGE_MS,
  shouldPersistQueryKey,
} from "@/lib/query-persist";

function RestoreSplash() {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
        gap: 20,
      }}
    >
      <Image
        source={require("@/assets/images/logo.png")}
        style={{ width: 96, height: 96, borderRadius: 48 }}
        contentFit="cover"
      />
      <ActivityIndicator color={colors.primary} size="small" />
    </View>
  );
}

export function PersistedQueryProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const authToken = useAuthToken();
  const userId = currentUser?.id ?? null;
  const [hydrated, setHydrated] = useState(false);

  const persister = useMemo(() => createGbairaiQueryPersister(userId), [userId]);

  useEffect(() => {
    if (!userId) {
      setHydrated(true);
      return;
    }

    setHydrated(hasWarmConversationCache());
  }, [userId]);

  if (!authToken || !userId) {
    return <QueryHydrationProvider hydrated>{children}</QueryHydrationProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: QUERY_PERSIST_MAX_AGE_MS,
        buster: userId,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => shouldPersistQueryKey(query.queryKey),
        },
      }}
      onSuccess={() => setHydrated(true)}
      onError={() => setHydrated(true)}
    >
      <QueryHydrationProvider hydrated={hydrated}>
        {hydrated ? children : <RestoreSplash />}
      </QueryHydrationProvider>
    </PersistQueryClientProvider>
  );
}

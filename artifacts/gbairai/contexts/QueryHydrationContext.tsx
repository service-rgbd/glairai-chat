import React, { createContext, useContext } from "react";

const QueryHydrationContext = createContext(true);

export function QueryHydrationProvider({
  hydrated,
  children,
}: {
  hydrated: boolean;
  children: React.ReactNode;
}) {
  return (
    <QueryHydrationContext.Provider value={hydrated}>{children}</QueryHydrationContext.Provider>
  );
}

export function useQueryHydrated() {
  return useContext(QueryHydrationContext);
}

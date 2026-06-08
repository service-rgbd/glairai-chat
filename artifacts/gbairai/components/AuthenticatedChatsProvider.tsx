import React from "react";

import { useAuth } from "@/contexts/AuthContext";
import { ChatsProvider } from "@/contexts/ChatsContext";

export function AuthenticatedChatsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (!isAuthenticated || isLoading) {
    return <>{children}</>;
  }

  return <ChatsProvider>{children}</ChatsProvider>;
}

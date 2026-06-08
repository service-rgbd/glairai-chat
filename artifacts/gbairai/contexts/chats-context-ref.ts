import { createContext, useContext, type Context } from "react";

import type { ChatsContextType } from "./chats-types";

const CHATS_CONTEXT_GLOBAL_KEY = "__gbairai_chats_context__";

type ChatsReactContext = Context<ChatsContextType | null>;

export function getOrCreateChatsContext(): ChatsReactContext {
  const globalRef = globalThis as typeof globalThis & {
    [CHATS_CONTEXT_GLOBAL_KEY]?: ChatsReactContext;
  };

  if (!globalRef[CHATS_CONTEXT_GLOBAL_KEY]) {
    globalRef[CHATS_CONTEXT_GLOBAL_KEY] = createContext<ChatsContextType | null>(null);
  }

  return globalRef[CHATS_CONTEXT_GLOBAL_KEY];
}

export const ChatsContext = getOrCreateChatsContext();

export function useChats(): ChatsContextType {
  const ctx = useContext(getOrCreateChatsContext());
  if (!ctx) {
    throw new Error("useChats must be used within ChatsProvider");
  }
  return ctx;
}

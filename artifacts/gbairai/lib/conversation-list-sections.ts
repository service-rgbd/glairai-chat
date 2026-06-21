import type { GChat } from "@/contexts/chats-types";
import type { Channel } from "@/modules/channels/types";

export type ConversationListFilter = "all" | "unread" | "direct" | "channels" | "groups";

export type ConversationListItem =
  | { kind: "chat"; id: string; chat: GChat }
  | { kind: "channel"; id: string; channel: Channel };

export type ConversationFilterCounts = {
  all: number;
  unread: number;
  direct: number;
  channels: number;
  groups: number;
};

function getChatSearchLabel(chat: GChat, displayName: string) {
  return chat.type === "group" ? (chat.name ?? "Groupe") : displayName;
}

function matchesChatSearch(chat: GChat, query: string, getDirectChatName: (chat: GChat) => string) {
  const label = getChatSearchLabel(chat, getDirectChatName(chat));
  return !query || label.toLowerCase().includes(query);
}

function matchesChannelSearch(channel: Channel, query: string) {
  return !query || channel.name.toLowerCase().includes(query);
}

export function getConversationFilterCounts(input: {
  chats: GChat[];
  channels: Channel[];
  search: string;
  getDirectChatName: (chat: GChat) => string;
}): ConversationFilterCounts {
  const query = input.search.trim().toLowerCase();
  const visibleChats = input.chats.filter((chat) =>
    matchesChatSearch(chat, query, input.getDirectChatName),
  );
  const visibleChannels = input.channels.filter((channel) => matchesChannelSearch(channel, query));

  return {
    all: visibleChats.length + visibleChannels.length,
    unread: visibleChats.filter((chat) => chat.unreadCount > 0).length,
    direct: visibleChats.filter((chat) => chat.type === "direct").length,
    channels: visibleChannels.length,
    groups: visibleChats.filter((chat) => chat.type === "group").length,
  };
}

export function buildFilteredConversationList(input: {
  chats: GChat[];
  channels: Channel[];
  filter: ConversationListFilter;
  search: string;
  getDirectChatName: (chat: GChat) => string;
  getChatSortAt: (chat: GChat) => string;
}): ConversationListItem[] {
  const query = input.search.trim().toLowerCase();
  const visibleChats = input.chats.filter((chat) =>
    matchesChatSearch(chat, query, input.getDirectChatName),
  );
  const visibleChannels = input.channels.filter((channel) => matchesChannelSearch(channel, query));

  if (input.filter === "channels") {
    return visibleChannels.map((channel) => ({
      kind: "channel",
      id: channel.id,
      channel,
    }));
  }

  let chatsForFilter = visibleChats;
  if (input.filter === "unread") {
    chatsForFilter = visibleChats.filter((chat) => chat.unreadCount > 0);
  } else if (input.filter === "direct") {
    chatsForFilter = visibleChats.filter((chat) => chat.type === "direct");
  } else if (input.filter === "groups") {
    chatsForFilter = visibleChats.filter((chat) => chat.type === "group");
  }

  const chatItems: ConversationListItem[] = chatsForFilter.map((chat) => ({
    kind: "chat",
    id: chat.id,
    chat,
  }));

  if (input.filter !== "all") {
    return chatItems.sort((a, b) => {
      if (a.kind !== "chat" || b.kind !== "chat") return 0;
      return input.getChatSortAt(b.chat).localeCompare(input.getChatSortAt(a.chat));
    });
  }

  const channelItems: ConversationListItem[] = visibleChannels.map((channel) => ({
    kind: "channel",
    id: channel.id,
    channel,
  }));

  return [...chatItems, ...channelItems].sort((a, b) => {
    const aSort =
      a.kind === "chat" ? input.getChatSortAt(a.chat) : a.channel.updatedAt;
    const bSort =
      b.kind === "chat" ? input.getChatSortAt(b.chat) : b.channel.updatedAt;
    return bSort.localeCompare(aSort);
  });
}

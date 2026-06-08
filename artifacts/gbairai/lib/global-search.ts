import type {
  ComposeContactOption,
  GChat,
  GMessage,
  GUser,
  MessageType,
} from "@/contexts/chats-types";

export type GlobalSearchResult =
  | {
      kind: "contact";
      id: string;
      title: string;
      subtitle: string;
      contact: ComposeContactOption;
    }
  | {
      kind: "conversation";
      id: string;
      title: string;
      subtitle: string;
      chat: GChat;
    }
  | {
      kind: "message";
      id: string;
      title: string;
      subtitle: string;
      chat: GChat;
      message: GMessage;
    };

const MEDIA_LABELS: Record<MessageType, string> = {
  text: "Message",
  image: "Photo",
  audio: "Message vocal",
  video: "Vidéo",
};

const FILE_KEYWORDS = [
  "fichier",
  "file",
  "photo",
  "image",
  "vidéo",
  "video",
  "vocal",
  "audio",
  "document",
  "pdf",
];

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function chatTitle(chat: GChat, users: Record<string, GUser>, getOtherUser: (chat: GChat) => GUser | undefined) {
  if (chat.type === "group") {
    return chat.name?.trim() || "Groupe";
  }
  return getOtherUser(chat)?.name ?? "Conversation";
}

function messagePreview(message: GMessage) {
  if (message.type === "text") {
    return message.content.replace(/\s+/g, " ").trim();
  }
  return MEDIA_LABELS[message.type];
}

function messageMatchesQuery(message: GMessage, query: string) {
  const normalized = normalizeQuery(query);
  if (!normalized) return false;

  if (message.type === "text") {
    return message.content.toLowerCase().includes(normalized);
  }

  const mediaLabel = MEDIA_LABELS[message.type].toLowerCase();
  if (mediaLabel.includes(normalized)) return true;

  return FILE_KEYWORDS.some(
    (keyword) => keyword.includes(normalized) || normalized.includes(keyword),
  );
}

function contactMatchesQuery(contact: ComposeContactOption, query: string) {
  const normalized = normalizeQuery(query);
  if (!normalized) return false;
  return (
    contact.name.toLowerCase().includes(normalized) ||
    contact.phone.toLowerCase().includes(normalized) ||
    (contact.bio?.toLowerCase().includes(normalized) ?? false)
  );
}

export function buildGlobalSearchResults(input: {
  query: string;
  chats: GChat[];
  messages: Record<string, GMessage[]>;
  users: Record<string, GUser>;
  contacts: ComposeContactOption[];
  getOtherUser: (chat: GChat) => GUser | undefined;
  limit?: number;
}): GlobalSearchResult[] {
  const query = normalizeQuery(input.query);
  if (!query) return [];

  const limit = input.limit ?? 60;
  const results: GlobalSearchResult[] = [];
  const seen = new Set<string>();

  for (const contact of input.contacts) {
    if (!contactMatchesQuery(contact, query)) continue;
    const id = `contact:${contact.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    results.push({
      kind: "contact",
      id,
      title: contact.name,
      subtitle: contact.isRegistered ? contact.phone : "Inviter sur Gbairai",
      contact,
    });
    if (results.length >= limit) return results;
  }

  for (const chat of input.chats) {
    const title = chatTitle(chat, input.users, input.getOtherUser);
    const other = input.getOtherUser(chat);
    const haystack = [title, other?.phone ?? "", other?.bio ?? ""].join(" ").toLowerCase();
    if (!haystack.includes(query)) continue;

    const id = `chat:${chat.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    results.push({
      kind: "conversation",
      id,
      title,
      subtitle: chat.type === "group" ? "Groupe" : other?.phone ?? "Discussion",
      chat,
    });
    if (results.length >= limit) return results;
  }

  for (const chat of input.chats) {
    const chatMessages = input.messages[chat.id] ?? [];
    const title = chatTitle(chat, input.users, input.getOtherUser);

    for (const message of chatMessages) {
      if (!messageMatchesQuery(message, query)) continue;
      const id = `message:${message.id}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const preview = messagePreview(message);
      results.push({
        kind: "message",
        id,
        title,
        subtitle: preview.length > 120 ? `${preview.slice(0, 117)}...` : preview,
        chat,
        message,
      });
      if (results.length >= limit) return results;
    }
  }

  return results;
}

import NetInfo from "@react-native-community/netinfo";
import {
  customFetch,
  addConversationMembers,
  createConversation,
  createGroupInvite,
  getGroupInvitePreview,
  joinGroupByInvite,
  leaveConversation,
  listConversationMessages,
  listConversations,
  markConversationRead,
  markMessageDelivered,
  removeConversationMember,
  sendConversationMessage,
  syncContacts,
  updateConversation,
  updatePresenceHeartbeat,
  type ContactMatch,
  type ConversationMessage,
  type ConversationSummary,
  type GroupInvite,
  type GroupInvitePreview,
  type MessageReceipt,
  type SendMessageInput,
} from "@workspace/api-client-react";
import type * as ExpoContacts from "expo-contacts";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { Alert, AppState, type AppStateStatus } from "react-native";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";

import { getOrCreateChatsContext } from "@/contexts/chats-context-ref";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryHydrated } from "@/contexts/QueryHydrationContext";
import { getApiBaseUrl } from "@/lib/api-config";
import {
  isContactsPermissionDenied,
  isContactsSyncFresh,
  markContactsPermissionDenied,
  markContactsSynced,
  resetContactsPermissionState,
  resetContactsSyncState,
  runContactsSyncOnce,
} from "@/lib/contacts-sync";
import { UserCacheKeys, migrateLegacyUserCache } from "@/lib/offline-cache";
import { setIncomingCall, clearIncomingCallIfMatches, getIncomingCall } from "@/lib/incoming-call";
import { shouldAcceptIncomingCall } from "@/lib/call-session-client";
import { fetchPendingIncomingCall } from "@/lib/calls";
import { countUnreadMissedCalls } from "@/lib/call-badge";
import { logConversationCall } from "@/lib/call-log";
import { emitCallSignal } from "@/lib/call-signaling";
import { isNativeLocalDbEnabled } from "@/lib/local-cache-enabled";
import { prefetchConversationListMedia } from "@/lib/media-prefetch";
import { isRealtimeSocketEnabled } from "@/lib/runtime-env";
import { safeGetItem, safeSetItem, scheduleSafeSetItem } from "@/lib/safe-storage";
import {
  hydrateChatCacheFromLocalDb,
  persistConversationsToLocalDb,
  persistMessagesToLocalDb,
} from "@/lib/chat-local-sync";
import {
  createMediaUploadTarget,
  encodeAudioMessagePayload,
  encodeImageMessagePayload,
  encodeStoryMediaPayload,
  encodeVideoMessagePayload,
  getDisplayMediaUrl,
  type StoryMediaPayload,
  uploadFileToSignedUrl,
  uploadStoryMediaWithThumbnail,
} from "@/lib/media";
import { encodeEmoji3dMessagePayload } from "@/lib/emoji-messages";
import {
  encodeDeletedMessageContent,
  encodeEditedTextMessageContent,
  getMessageDisplayContent,
} from "@/lib/message-meta";
import { encodeViewOnceOpenedContent } from "@/lib/view-once-media";
import { MessageSoundsBridge } from "@/components/MessageSoundsBridge";
import { parseGroupSettings } from "@/lib/group-settings";
import {
  encodeTextMessageContent,
  extractReplyFromContent,
  type MessageReplyRef,
} from "@/lib/message-reply";
import {
  acceptGroupMemberInvite as acceptGroupMemberInviteApi,
  declineGroupMemberInvite as declineGroupMemberInviteApi,
  listGroupMemberInvites,
  type GroupMemberInvite,
} from "@/lib/group-member-invites";
import {
  setMessageReaction,
  type MessageReactionSummary,
} from "@/lib/message-reactions";
import { runWithUploadStatus } from "@/lib/upload-status";
import {
  E2E_FALLBACK_LABEL,
  ensureE2eDeviceRegistered,
  encryptDirectTextMessage,
  isE2eEnabled,
  isE2ePayload,
  resetE2eBootstrapCache,
  shouldEncryptDirectText,
  tryDecryptDirectTextMessage,
} from "@/lib/e2e";

import type {
  ChatsContextType,
  ComposeContactOption,
  GCall,
  GChat,
  GMessage,
  GStory,
  GUser,
  ImportedPhoneContact,
  MessageType,
  MessageStatus,
  StoryComposerDraft,
} from "./chats-types";

export type * from "./chats-types";
export { formatTimestamp } from "@/lib/format-timestamp";
export { MOCK_CALLS } from "@/lib/mock-calls";

const MOCK_USERS: Record<string, GUser> = {
  u1: { id: "u1", name: "Aminata Diallo", phone: "+224 622 134 567", avatar: null, bio: "La vie est belle", status: "En ligne", lastSeen: null, initials: "AD", color: "#6D4AFF" },
  u2: { id: "u2", name: "Ibrahim Kouyaté", phone: "+224 625 987 321", avatar: null, bio: "Dev passionné", status: "Bonjour!", lastSeen: new Date(Date.now() - 25 * 60 * 1000).toISOString(), initials: "IK", color: "#00D4A4" },
  u3: { id: "u3", name: "Mariama Camara", phone: "+224 628 456 789", avatar: null, bio: "Entrepreneur | Manager", status: "Au travail", lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), initials: "MC", color: "#FF6B6B" },
  u4: { id: "u4", name: "Oumar Traoré", phone: "+224 621 234 567", avatar: null, bio: "Ingénieur, amateur de foot", status: "En ligne", lastSeen: null, initials: "OT", color: "#FFB347" },
  u5: { id: "u5", name: "Fatou Sow", phone: "+224 623 765 432", avatar: null, bio: "Médecin | Cardiologue", status: "Ne pas déranger", lastSeen: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), initials: "FS", color: "#4ECDC4" },
  u6: { id: "u6", name: "Mohamed Bah", phone: "+224 626 111 222", avatar: null, bio: "Artiste | Musicien", status: "En ligne", lastSeen: null, initials: "MB", color: "#45B7D1" },
  u7: { id: "u7", name: "Aissatou Koné", phone: "+224 629 333 444", avatar: null, bio: "Mère de famille | Enseignante", status: "Disponible", lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), initials: "AK", color: "#96CEB4" },
  u8: { id: "u8", name: "Djénéba Barry", phone: "+224 624 555 666", avatar: null, bio: "Business Woman", status: "En ligne", lastSeen: null, initials: "DB", color: "#DDA0DD" },
};

const now = Date.now();
const h = (hours: number) => new Date(now - hours * 3600000).toISOString();

const INITIAL_MESSAGES: Record<string, GMessage[]> = {
  c1: [
    { id: "m1_1", chatId: "c1", senderId: "u1", content: "Bonjour! Comment tu vas?", type: "text", status: "read", timestamp: h(0.6) },
    { id: "m1_2", chatId: "c1", senderId: "me", content: "Très bien merci! Et toi?", type: "text", status: "read", timestamp: h(0.5) },
    { id: "m1_3", chatId: "c1", senderId: "u1", content: "Super! Tu as vu le match hier soir?", type: "text", status: "read", timestamp: h(0.4) },
    { id: "m1_4", chatId: "c1", senderId: "me", content: "Oui! Incroyable ce but à la 90ème minute!", type: "text", status: "read", timestamp: h(0.35) },
    { id: "m1_5", chatId: "c1", senderId: "u1", content: "Haha oui! On fait quoi ce weekend?", type: "text", status: "delivered", timestamp: h(0.25) },
  ],
  c2: [
    { id: "m2_1", chatId: "c2", senderId: "me", content: "Ibrahim, tu es en route?", type: "text", status: "read", timestamp: h(0.8) },
    { id: "m2_2", chatId: "c2", senderId: "u2", content: "Oui j'arrive, il y a un bouchon", type: "text", status: "read", timestamp: h(0.6) },
    { id: "m2_3", chatId: "c2", senderId: "u2", content: "Ok je serai là dans 20 min", type: "text", status: "read", timestamp: h(0.4) },
    { id: "m2_4", chatId: "c2", senderId: "me", content: "Ok pas de problème, j'attends", type: "text", status: "read", timestamp: h(0.3) },
  ],
  c3: [
    { id: "m3_1", chatId: "c3", senderId: "u3", content: "La réunion de demain est confirmée à 10h", type: "text", status: "read", timestamp: h(26) },
    { id: "m3_2", chatId: "c3", senderId: "me", content: "Parfait, je serai là", type: "text", status: "read", timestamp: h(25) },
    { id: "m3_3", chatId: "c3", senderId: "u3", content: "N'oublie pas d'apporter les documents", type: "text", status: "delivered", timestamp: h(24) },
  ],
  c4: [
    { id: "m4_1", chatId: "c4", senderId: "u4", content: "On se retrouve au carrefour Kaloum", type: "text", status: "read", timestamp: h(30) },
    { id: "m4_2", chatId: "c4", senderId: "me", content: "Super! À quelle heure?", type: "text", status: "read", timestamp: h(29) },
    { id: "m4_3", chatId: "c4", senderId: "u4", content: "17h, ça te va?", type: "text", status: "read", timestamp: h(28.5) },
    { id: "m4_4", chatId: "c4", senderId: "me", content: "Super, on se retrouve là-bas!", type: "text", status: "read", timestamp: h(28) },
  ],
  c5: [
    { id: "m5_1", chatId: "c5", senderId: "u5", content: "J'ai envoyé les documents au cabinet", type: "text", status: "read", timestamp: h(72) },
    { id: "m5_2", chatId: "c5", senderId: "me", content: "Merci Fatou! Je les révise aujourd'hui", type: "text", status: "read", timestamp: h(71) },
    { id: "m5_3", chatId: "c5", senderId: "u5", content: "Dis-moi si tu as des questions", type: "text", status: "read", timestamp: h(70) },
  ],
  c6: [
    { id: "m6_1", chatId: "c6", senderId: "u6", content: "Écoute mon nouveau morceau!", type: "text", status: "read", timestamp: h(74) },
    { id: "m6_2", chatId: "c6", senderId: "me", content: "C'est vraiment de feu!", type: "text", status: "read", timestamp: h(73) },
    { id: "m6_3", chatId: "c6", senderId: "u6", content: "Tu peux appeler ce soir?", type: "text", status: "delivered", timestamp: h(72) },
  ],
  c7: [
    { id: "m7_1", chatId: "c7", senderId: "u4", content: "Bonne journée à tous!", type: "text", status: "read", timestamp: h(168) },
    { id: "m7_2", chatId: "c7", senderId: "u7", content: "Bonne journée Oumar!", type: "text", status: "read", timestamp: h(167) },
    { id: "m7_3", chatId: "c7", senderId: "u7", content: "Bonne nuit tout le monde", type: "text", status: "delivered", timestamp: h(156) },
  ],
  c8: [
    { id: "m8_1", chatId: "c8", senderId: "u8", content: "On repart pour une nouvelle semaine!", type: "text", status: "read", timestamp: h(170) },
    { id: "m8_2", chatId: "c8", senderId: "me", content: "Exact! Au boulot!", type: "text", status: "read", timestamp: h(169) },
  ],
};

const INITIAL_CHATS: GChat[] = [
  { id: "c1", type: "direct", participantIds: ["me", "u1"], unreadCount: 3 },
  { id: "c2", type: "direct", participantIds: ["me", "u2"], unreadCount: 0 },
  { id: "c3", type: "direct", participantIds: ["me", "u3"], unreadCount: 2 },
  { id: "c4", type: "direct", participantIds: ["me", "u4"], unreadCount: 0 },
  { id: "c5", type: "direct", participantIds: ["me", "u5"], unreadCount: 0 },
  { id: "c6", type: "direct", participantIds: ["me", "u6"], unreadCount: 1 },
  { id: "c7", type: "group", participantIds: ["me", "u7", "u4", "u2"], name: "Famille Koné", unreadCount: 5 },
  { id: "c8", type: "direct", participantIds: ["me", "u8"], unreadCount: 0 },
];

const INITIAL_STORIES: GStory[] = [
  { id: "s1", userId: "u1", type: "text", content: "Bonne journée à tous!", backgroundColor: "#6D4AFF", expiresAt: new Date(now + 20 * 3600000).toISOString(), viewerIds: [], createdAt: h(4) },
  { id: "s2", userId: "u4", type: "text", content: "Allez les Lions!", backgroundColor: "#FF6B6B", expiresAt: new Date(now + 18 * 3600000).toISOString(), viewerIds: ["me"], createdAt: h(6) },
  { id: "s3", userId: "u6", type: "text", content: "Nouveau son disponible maintenant", backgroundColor: "#00D4A4", expiresAt: new Date(now + 15 * 3600000).toISOString(), viewerIds: [], createdAt: h(8) },
  { id: "s4", userId: "u8", type: "text", content: "Journée productive!", backgroundColor: "#45B7D1", expiresAt: new Date(now + 10 * 3600000).toISOString(), viewerIds: ["me"], createdAt: h(10) },
];

const ONLINE_PRESENCE_INTERVAL = 20_000;
const CONVERSATIONS_STALE_MS = 1000 * 60 * 2;
const MESSAGES_STALE_MS = 1000 * 60 * 10;
const E2E_PLAINTEXT_CACHE_PREFIX = "@gbairai/e2e/plaintext:";
const E2E_PLAINTEXT_CACHE_LIMIT = 500;
const MUTED_CONVERSATIONS_PREFIX = "@gbairai/conversations/muted:";

function e2ePlaintextCacheKey(userId: string) {
  return `${E2E_PLAINTEXT_CACHE_PREFIX}${userId}`;
}

function mutedConversationsKey(userId: string) {
  return `${MUTED_CONVERSATIONS_PREFIX}${userId}`;
}

function isHttpNotFound(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: number }).status === 404
  );
}

function trimE2ePlaintextCache(cache: Record<string, string>) {
  const entries = Object.entries(cache);
  if (entries.length <= E2E_PLAINTEXT_CACHE_LIMIT) return cache;
  return Object.fromEntries(entries.slice(entries.length - E2E_PLAINTEXT_CACHE_LIMIT));
}

const ChatsReactContext = getOrCreateChatsContext();

export function useChats(): ChatsContextType {
  const ctx = useContext(ChatsReactContext);
  if (!ctx) {
    throw new Error("useChats must be used within ChatsProvider");
  }
  return ctx;
}

type ConversationsPage = { conversations: ConversationSummary[] };
type ExtendedConversationSummary = ConversationSummary & { isArchived?: boolean; isMuted?: boolean };
type MessagesPage = { messages: ConversationMessage[]; nextCursor: string | null };
type RealtimeSocketEvent = {
  conversationId?: string;
  messageId?: string;
  message?: ConversationMessage;
  userId?: string;
  messageSenderId?: string;
  reactions?: MessageReactionSummary[];
  groupMemberInvite?: GroupMemberInvite;
  receipt?: MessageReceipt;
  conversation?: ConversationSummary;
  removedUserId?: string;
  callerUserId?: string;
  callerName?: string;
  callerAvatarUrl?: string | null;
  callType?: "audio" | "video";
  callId?: string;
  story?: GStory;
  presence?: {
    userId: string;
    snapshot: {
      isOnline: boolean;
      lastSeenAt: string | null;
    };
  };
};
type OutboxItem = {
  localId: string;
  chatId: string;
  content: string;
  type: MessageType;
  createdAt: string;
  status: "sending" | "failed";
  replyTo?: MessageReplyRef;
};

function normalizePhoneNumber(phone: string, defaultCountryCode = "GN") {
  const trimmed = phone.trim();
  const parsed =
    parsePhoneNumberFromString(trimmed, defaultCountryCode as never) ??
    parsePhoneNumberFromString(trimmed);

  if (parsed) {
    return parsed.number;
  }

  const digits = trimmed.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) {
    throw new Error("Numéro invalide");
  }
  return digits;
}

function getContactDisplayName(contact: ExpoContacts.Contact, fallbackPhone: string) {
  const fullName = contact.name?.trim();
  if (fullName) return fullName;

  const composedName = [contact.firstName, contact.middleName, contact.lastName]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();

  if (composedName) return composedName;
  return fallbackPhone.trim() || "Contact sans nom";
}

function initialsFromName(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "GB"
  );
}

function pickContactColor(seed: string) {
  const palette = ["#6D4AFF", "#00D4A4", "#FF6B6B", "#FFB347", "#4ECDC4", "#45B7D1"];
  const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[total % palette.length] ?? "#6D4AFF";
}

function upsertConversationMessage(
  messages: ConversationMessage[],
  incomingMessage: ConversationMessage,
) {
  const filtered = messages.filter((message) => message.id !== incomingMessage.id);
  return [...filtered, incomingMessage].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}

function patchParticipantPresence(
  conversations: ConversationSummary[],
  userId: string,
  snapshot: { isOnline: boolean; lastSeenAt: string | null },
) {
  return conversations.map((conversation) => ({
    ...conversation,
    participants: conversation.participants.map((participant) =>
      participant.userId === userId
        ? {
            ...participant,
            profile: {
              ...participant.profile,
              presence: {
                isOnline: snapshot.isOnline,
                lastSeenAt: snapshot.lastSeenAt,
              },
            },
          }
        : participant,
    ),
  }));
}

function getDirectPeerUserId(
  conversation: Pick<ConversationSummary, "type" | "participants">,
  currentUserId: string,
) {
  if (conversation.type !== "direct") return null;
  return conversation.participants.find((participant) => participant.userId !== currentUserId)
    ?.userId ?? null;
}

function resolveE2eSessionPeerUserId(
  conversationId: string,
  senderId: string,
  currentUserId: string,
  conversations: Map<string, ConversationSummary>,
) {
  if (senderId !== currentUserId) return senderId;
  const conversation = conversations.get(conversationId);
  if (!conversation) return null;
  return getDirectPeerUserId(conversation, currentUserId);
}

function toReadableMessageContent(
  message: Pick<ConversationMessage, "content">,
  decryptedContent?: string,
  decryptFailed?: boolean,
) {
  if (decryptedContent) {
    return getMessageDisplayContent(decryptedContent).displayContent;
  }
  if (isE2ePayload(message.content)) {
    if (decryptFailed) {
      return E2E_FALLBACK_LABEL;
    }
    // Déchiffrement en cours : ne rien afficher (le message est masqué
    // de la liste tant que le texte en clair n'est pas disponible).
    return "";
  }
  return getMessageDisplayContent(message.content).displayContent;
}

function isPendingE2eDecrypt(
  message: Pick<ConversationMessage, "content">,
  decryptedContent?: string,
  decryptFailed?: boolean,
) {
  return isE2ePayload(message.content) && !decryptedContent && !decryptFailed;
}

function toGMessageMeta(
  message: Pick<ConversationMessage, "content">,
  decryptedContent?: string,
) {
  const source = decryptedContent ?? message.content;
  const { isDeleted, editedAt } = getMessageDisplayContent(source);
  return { isDeleted, editedAt };
}

function upsertConversationSummary(
  conversations: ConversationSummary[],
  incomingConversation: ConversationSummary,
) {
  return [
    incomingConversation,
    ...conversations.filter((conversation) => conversation.id !== incomingConversation.id),
  ];
}

function removeConversationMessage(
  messages: ConversationMessage[],
  messageId: string,
) {
  return messages.filter((message) => message.id !== messageId);
}

function updateConversationSummaryWithMessage(
  conversations: ConversationSummary[],
  incomingMessage: ConversationMessage,
  currentUserId: string,
  isReadLocally = false,
) {
  return conversations
    .map((conversation) => {
      if (conversation.id !== incomingMessage.conversationId) {
        return conversation;
      }
      const unreadCount =
        incomingMessage.senderId !== currentUserId && !isReadLocally
          ? conversation.unreadCount + 1
          : conversation.unreadCount;
      return {
        ...conversation,
        unreadCount,
        lastMessage: incomingMessage,
      };
    })
    .sort((left, right) =>
      (right.lastMessage?.createdAt ?? "").localeCompare(left.lastMessage?.createdAt ?? ""),
    );
}

function updateConversationSummaryWithReceipt(
  conversations: ConversationSummary[],
  receipt: MessageReceipt,
) {
  return conversations.map((conversation) => {
    if (
      conversation.id !== receipt.conversationId ||
      !conversation.lastMessage ||
      conversation.lastMessage.id !== receipt.messageId
    ) {
      return conversation;
    }
    return {
      ...conversation,
      lastMessage: {
        ...conversation.lastMessage,
        receipts: upsertReceipt(conversation.lastMessage.receipts, receipt),
      },
    };
  });
}

function updateConversationSummaryWithEditedMessage(
  conversations: ConversationSummary[],
  incomingMessage: ConversationMessage,
) {
  return conversations.map((conversation) => {
    if (
      conversation.id !== incomingMessage.conversationId ||
      !conversation.lastMessage ||
      conversation.lastMessage.id !== incomingMessage.id
    ) {
      return conversation;
    }
    return {
      ...conversation,
      lastMessage: incomingMessage,
    };
  });
}

function removeMatchingSendingOutboxItem(
  items: OutboxItem[],
  incomingMessage: ConversationMessage,
) {
  const matchIndex = items.findIndex(
    (item) =>
      item.status === "sending" &&
      item.chatId === incomingMessage.conversationId &&
      item.type === incomingMessage.type &&
      item.content === incomingMessage.content,
  );

  if (matchIndex < 0) {
    return items;
  }

  return items.filter((_, index) => index !== matchIndex);
}

function applyReceiptToMessages(
  messages: ConversationMessage[],
  receipt: MessageReceipt,
) {
  const targetMessage = messages.find((message) => message.id === receipt.messageId);
  return messages.map((message) => {
    const shouldApplyReceipt =
      message.id === receipt.messageId ||
      (Boolean(receipt.readAt) &&
        Boolean(targetMessage) &&
        message.conversationId === receipt.conversationId &&
        message.senderId !== receipt.userId &&
        message.createdAt <= targetMessage!.createdAt);

    if (!shouldApplyReceipt) {
      return message;
    }

    const existingReceiptIndex = message.receipts.findIndex(
      (entry) => entry.userId === receipt.userId,
    );
    if (existingReceiptIndex < 0) {
      return { ...message, receipts: [...message.receipts, receipt] };
    }

    const nextReceipts = [...message.receipts];
    nextReceipts[existingReceiptIndex] = mergeReceipt(
      nextReceipts[existingReceiptIndex]!,
      receipt,
    );
    return { ...message, receipts: nextReceipts };
  });
}

function mergeReceipt(existing: MessageReceipt, incoming: MessageReceipt): MessageReceipt {
  return {
    ...existing,
    ...incoming,
    deliveredAt: incoming.deliveredAt ?? existing.deliveredAt,
    readAt: incoming.readAt ?? existing.readAt,
  };
}

function upsertReceipt(
  receipts: MessageReceipt[],
  receipt: MessageReceipt,
) {
  const existingReceiptIndex = receipts.findIndex((entry) => entry.userId === receipt.userId);
  if (existingReceiptIndex < 0) {
    return [...receipts, receipt];
  }

  const nextReceipts = [...receipts];
  nextReceipts[existingReceiptIndex] = mergeReceipt(
    nextReceipts[existingReceiptIndex]!,
    receipt,
  );
  return nextReceipts;
}

function toGMessageContent(
  message: Pick<ConversationMessage, "content" | "type">,
  decryptedContent?: string,
  decryptFailed?: boolean,
) {
  if (message.type !== "text") {
    return message.content;
  }
  const source = decryptedContent ?? message.content;
  if (!isE2ePayload(message.content) || decryptedContent) {
    const extracted = extractReplyFromContent(source);
    if (extracted.replyTo) {
      return getMessageDisplayContent(extracted.body).displayContent;
    }
  }
  return toReadableMessageContent(message, decryptedContent, decryptFailed);
}

function toGMessage(
  message: ConversationMessage & { reactions?: MessageReactionSummary[] },
  currentUserId: string,
  toMessageStatus: (message: ConversationMessage, currentUserId: string) => MessageStatus,
  decryptedContent?: string,
  decryptFailed?: boolean,
): GMessage {
  const meta = toGMessageMeta(message, decryptedContent);
  let replyTo: MessageReplyRef | undefined;
  if (message.type === "text" && (!isE2ePayload(message.content) || decryptedContent)) {
    replyTo = extractReplyFromContent(decryptedContent ?? message.content).replyTo ?? undefined;
  }
  return {
    id: message.id,
    chatId: message.conversationId,
    senderId: message.senderId,
    content: toGMessageContent(message, decryptedContent, decryptFailed),
    type: meta.isDeleted ? "text" : message.type,
    status: toMessageStatus(message, currentUserId),
    timestamp: message.createdAt,
    editedAt: meta.editedAt,
    isDeleted: meta.isDeleted,
    replyTo,
    reactions: Array.isArray(message.reactions) ? message.reactions : [],
  };
}

function sortGMessages(messages: GMessage[]) {
  return [...messages].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { authToken, currentUser, isAuthenticated, registerPushDevice } = useAuth();
  const queryHydrated = useQueryHydrated();
  const prevAuthTokenRef = useRef<string | null>(null);
  const composeContactsRef = useRef<ComposeContactOption[]>([]);
  const [loadedConversationIds, setLoadedConversationIds] = useState<string[]>([]);
  const [stories, setStories] = useState<GStory[]>([]);
  const [composeContactsSnapshot, setComposeContactsSnapshot] = useState<ComposeContactOption[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [calls, setCalls] = useState<GCall[]>([]);
  const [callsLastSeenAt, setCallsLastSeenAt] = useState<string | null>(null);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [localMutedConversationIds, setLocalMutedConversationIds] = useState<string[]>([]);
  const [localCacheHydrated, setLocalCacheHydrated] = useState(false);
  const [localStorageReady, setLocalStorageReady] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [typingByConversation, setTypingByConversation] = useState<Record<string, string[]>>({});
  const [pendingGroupInvites, setPendingGroupInvites] = useState<GroupMemberInvite[]>([]);
  const [groupInviteActionId, setGroupInviteActionId] = useState<string | null>(null);
  const [e2eDecryptCache, setE2eDecryptCache] = useState<Record<string, string>>({});
  const [e2eDecryptFailed, setE2eDecryptFailed] = useState<Record<string, true>>({});
  const [e2eReady, setE2eReady] = useState(false);
  const e2eDecryptInflightRef = useRef(new Set<string>());
  const e2eDecryptCacheRef = useRef<Record<string, string>>({});
  const e2eDecryptFailedRef = useRef<Record<string, true>>({});
  const e2eDecryptWarnedRef = useRef(new Set<string>());
  const socketRef = useRef<Socket | null>(null);
  const isFlushingOutbox = useRef(false);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const typingEmitStateRef = useRef<Record<string, boolean>>({});
  const lastReadMessageByChatRef = useRef<Record<string, string>>({});
  const presenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadedConversationIdsRef = useRef<string[]>([]);
  const activeConversationIdsRef = useRef<Set<string>>(new Set());
  const playConversationListSoundRef = useRef<(() => void) | null>(null);
  const playChatIncomingSoundRef = useRef<(() => void) | null>(null);
  const cachedUserIdRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const localMutedConversationIdsRef = useRef<string[]>([]);

  useEffect(() => {
    localMutedConversationIdsRef.current = localMutedConversationIds;
  }, [localMutedConversationIds]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) {
      return;
    }

    const userId = currentUser.id;
    let cancelled = false;

    const loadUserCache = async () => {
      try {
        await migrateLegacyUserCache(userId);

        const [
          rawOutbox,
          rawComposeContacts,
          rawCalls,
          rawLoadedConversations,
          rawCallsLastSeenAt,
          rawMutedConversations,
        ] =
          await Promise.all([
            safeGetItem(UserCacheKeys.outbox(userId)),
            safeGetItem(UserCacheKeys.composeContacts(userId)),
            safeGetItem(UserCacheKeys.calls(userId)),
            safeGetItem(UserCacheKeys.loadedConversations(userId)),
            safeGetItem(UserCacheKeys.callsLastSeenAt(userId)),
            safeGetItem(mutedConversationsKey(userId)),
          ]);

        if (cancelled) return;

        if (rawOutbox) {
          setOutbox(JSON.parse(rawOutbox));
        }
        if (rawComposeContacts) {
          const parsed = JSON.parse(rawComposeContacts) as ComposeContactOption[];
          setComposeContactsSnapshot(parsed);
          if (parsed.length > 0) {
            markContactsSynced();
          }
        }
        if (rawCalls) {
          const parsed = JSON.parse(rawCalls) as Array<GCall & { failed?: boolean }>;
          setCalls(
            parsed.map((call) => ({
              ...call,
              failed: call.failed ?? false,
            })),
          );
        }
        if (rawLoadedConversations) {
          const parsed = JSON.parse(rawLoadedConversations) as string[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setLoadedConversationIds(parsed);
          }
        }
        if (rawCallsLastSeenAt) {
          setCallsLastSeenAt(rawCallsLastSeenAt);
        } else {
          setCallsLastSeenAt(new Date().toISOString());
        }
        if (rawMutedConversations) {
          const parsed = JSON.parse(rawMutedConversations) as string[];
          setLocalMutedConversationIds(Array.isArray(parsed) ? parsed : []);
        } else {
          setLocalMutedConversationIds([]);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) {
          setLocalStorageReady(true);
        }
      }
    };

    if (cachedUserIdRef.current && cachedUserIdRef.current !== userId) {
      setLoadedConversationIds([]);
      setOutbox([]);
      setCalls([]);
      setComposeContactsSnapshot([]);
      setLocalMutedConversationIds([]);
    }
    cachedUserIdRef.current = userId;

    setLocalStorageReady(false);
    void loadUserCache();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, currentUser?.id]);

  useEffect(() => {
    if (!isAuthenticated || !localStorageReady || !currentUser?.id) return;
    return scheduleSafeSetItem(UserCacheKeys.outbox(currentUser.id), JSON.stringify(outbox));
  }, [outbox, currentUser?.id, localStorageReady, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !localStorageReady || !currentUser?.id) return;
    void safeSetItem(UserCacheKeys.calls(currentUser.id), JSON.stringify(calls));
  }, [calls, currentUser?.id, localStorageReady, isAuthenticated]);

  useEffect(() => {
    if (!localStorageReady || !isAuthenticated || !currentUser?.id || !callsLastSeenAt) {
      return;
    }
    void safeSetItem(UserCacheKeys.callsLastSeenAt(currentUser.id), callsLastSeenAt);
  }, [callsLastSeenAt, currentUser?.id, localStorageReady, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !localStorageReady || !currentUser?.id) return;
    return scheduleSafeSetItem(
      UserCacheKeys.loadedConversations(currentUser.id),
      JSON.stringify(loadedConversationIds),
    );
  }, [loadedConversationIds, currentUser?.id, localStorageReady, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !localStorageReady || !currentUser?.id) return;
    return scheduleSafeSetItem(
      mutedConversationsKey(currentUser.id),
      JSON.stringify(localMutedConversationIds),
    );
  }, [currentUser?.id, isAuthenticated, localMutedConversationIds, localStorageReady]);

  useEffect(() => {
    if (!isAuthenticated || !localStorageReady || !currentUser?.id) return;
    return scheduleSafeSetItem(
      UserCacheKeys.composeContacts(currentUser.id),
      JSON.stringify(composeContactsSnapshot),
    );
  }, [composeContactsSnapshot, currentUser?.id, localStorageReady, isAuthenticated]);

  useEffect(() => {
    loadedConversationIdsRef.current = loadedConversationIds;
  }, [loadedConversationIds]);

  useEffect(() => {
    composeContactsRef.current = composeContactsSnapshot;
  }, [composeContactsSnapshot]);

  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listConversations(),
    enabled: isAuthenticated && queryHydrated,
    staleTime: CONVERSATIONS_STALE_MS,
    refetchOnMount: false,
  });

  const storiesQuery = useQuery({
    queryKey: ["stories"],
    queryFn: () => customFetch<{ stories: GStory[] }>("/api/stories"),
    enabled: isAuthenticated && queryHydrated,
    staleTime: CONVERSATIONS_STALE_MS,
    refetchOnMount: false,
  });

  const blockedUsersQuery = useQuery({
    queryKey: ["blocked-users"],
    queryFn: () => customFetch<{ userIds: string[] }>("/api/blocked-users"),
    enabled: isAuthenticated && queryHydrated,
    staleTime: CONVERSATIONS_STALE_MS,
    refetchOnMount: false,
  });

  useEffect(() => {
    setBlockedUserIds(blockedUsersQuery.data?.userIds ?? []);
  }, [blockedUsersQuery.data?.userIds]);

  useEffect(() => {
    if (!isAuthenticated) {
      setBlockedUserIds([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const previousToken = prevAuthTokenRef.current;
    prevAuthTokenRef.current = authToken;

    if (!authToken || !previousToken || previousToken === authToken) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    void queryClient.invalidateQueries({ queryKey: ["stories"] });
    void queryClient.invalidateQueries({ queryKey: ["blocked-users"] });
  }, [authToken, queryClient]);

  const knownConversationIds = useMemo(() => {
    const ids = new Set<string>(loadedConversationIds);
    for (const conversation of conversationsQuery.data?.conversations ?? []) {
      ids.add(conversation.id);
    }
    for (const item of outbox) {
      ids.add(item.chatId);
    }
    return Array.from(ids);
  }, [conversationsQuery.data?.conversations, loadedConversationIds, outbox]);

  const currentUserId = currentUser?.id ?? "me";

  const messageQueries = useQueries({
    queries: knownConversationIds.map((chatId) => ({
      queryKey: ["messages", chatId],
      queryFn: () => listConversationMessages(chatId, { limit: 100 }),
      enabled: isAuthenticated && loadedConversationIds.includes(chatId),
      staleTime: MESSAGES_STALE_MS,
    })),
  });

  useEffect(() => {
    if (!isAuthenticated || !localStorageReady) {
      if (!isAuthenticated) {
        setLocalCacheHydrated(false);
      }
      return;
    }

    if (!isNativeLocalDbEnabled()) {
      setLocalCacheHydrated(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await hydrateChatCacheFromLocalDb(queryClient, loadedConversationIdsRef.current);
      } catch {
        // ignore local cache failures at startup
      }
      if (!cancelled) {
        setLocalCacheHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authToken, localStorageReady, loadedConversationIds, queryClient]);

  useEffect(() => {
    const conversations = conversationsQuery.data?.conversations;
    if (!localCacheHydrated || !conversations?.length) return;

    const messagesByChatId: Record<string, ConversationMessage[]> = {};
    for (const [index, chatId] of knownConversationIds.entries()) {
      const page = messageQueries[index]?.data;
      if (page?.messages?.length) {
        messagesByChatId[chatId] = page.messages;
      }
    }

    void prefetchConversationListMedia(conversations, messagesByChatId);
  }, [
    localCacheHydrated,
    conversationsQuery.data?.conversations,
    knownConversationIds,
    messageQueries,
  ]);

  useEffect(() => {
    const conversations = conversationsQuery.data?.conversations;
    if (!localCacheHydrated || !conversations?.length) return;
    void persistConversationsToLocalDb(conversations).catch(() => {});
  }, [conversationsQuery.data?.conversations, localCacheHydrated]);

  useEffect(() => {
    if (!localCacheHydrated) return;
    for (const [index, query] of messageQueries.entries()) {
      const chatId = knownConversationIds[index];
      if (!chatId || !query.data?.messages?.length) continue;
      void persistMessagesToLocalDb(chatId, query.data.messages).catch(() => {});
    }
  }, [localCacheHydrated, messageQueries, knownConversationIds]);

  const flushOutbox = async () => {
    if (!authToken || isFlushingOutbox.current) return;
    const network = await NetInfo.fetch();
    if (!network.isConnected) return;

    isFlushingOutbox.current = true;
    try {
      for (const queued of outbox.filter((item) => item.status === "failed")) {
        const wireContent = await maybeEncryptTextPayload(
          queued.chatId,
          queued.content,
          queued.type,
        );
        const sentMessage = await sendConversationMessage(queued.chatId, {
          content: wireContent,
          type: queued.type,
        } satisfies SendMessageInput);
        queryClient.setQueryData<MessagesPage>(["messages", queued.chatId], (current) => ({
          messages: upsertConversationMessage(current?.messages ?? [], sentMessage),
          nextCursor: current?.nextCursor ?? null,
        }));
        if (isE2ePayload(wireContent)) {
          persistE2ePlaintextCache({ [sentMessage.id]: queued.content });
        }
        setOutbox((prev) => prev.filter((item) => item.localId !== queued.localId));
      }
    } finally {
      isFlushingOutbox.current = false;
    }
  };

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        void flushOutbox();
      }
    });

    return () => unsubscribe();
  }, [authToken, outbox]);

  useEffect(() => {
    if (!authToken || !isRealtimeSocketEnabled()) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }
      return;
    }

    let socket: Socket | null = null;
    let cancelled = false;

    void import("socket.io-client")
      .then(({ io }) => {
        if (cancelled) return;

        try {
          socket = io(getApiBaseUrl(), {
            transports: ["websocket", "polling"],
            auth: { token: authToken },
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
          });
        } catch (error) {
          if (__DEV__) {
            console.warn("[Gbairai] socket init failed:", error);
          }
          return;
        }

        socketRef.current = socket;
        const activeSocket = socket;

        activeSocket.on("connect", () => {
          if (__DEV__) {
            console.log("[Gbairai] socket connecté");
          }
          setSocketConnected(true);
          if (currentUser?.id) {
            void ensureE2eDeviceRegistered(currentUser.id, { forceRegister: true });
          }
          activeSocket.emit("presence:heartbeat", { isOnline: appStateRef.current === "active" });
          void queryClient.refetchQueries({ queryKey: ["conversations"], stale: true });
          void Promise.all(
            loadedConversationIdsRef.current.map((chatId) =>
              queryClient.refetchQueries({ queryKey: ["messages", chatId], stale: true }),
            ),
          );
          for (const chatId of activeConversationIdsRef.current) {
            activeSocket.emit("conversation:join", { conversationId: chatId });
          }
        });

        socket.on("disconnect", (reason) => {
          if (__DEV__) {
            console.log("[Gbairai] socket déconnecté:", reason);
          }
          setSocketConnected(false);
        });

        socket.on("connect_error", (error) => {
          if (__DEV__) {
            console.warn("[Gbairai] socket connect_error:", error.message);
          }
          setSocketConnected(false);
        });

        socket.on("message.created", (event?: RealtimeSocketEvent) => {
      if (!event?.conversationId || !event.message) {
        return;
      }

      setLoadedConversationIds((prev) =>
        prev.includes(event.conversationId!) ? prev : [...prev, event.conversationId!],
      );

      queryClient.setQueryData<MessagesPage>(["messages", event.conversationId], (current) => ({
        messages: upsertConversationMessage(current?.messages ?? [], event.message!),
        nextCursor: current?.nextCursor ?? null,
      }));
      if (event.message.senderId === currentUser?.id) {
        if (isE2ePayload(event.message.content)) {
          // L'écho socket arrive souvent avant la réponse HTTP : le contenu
          // est chiffré et ne correspond plus à l'item optimiste. On récupère
          // le texte en clair depuis l'outbox pour un affichage instantané.
          setOutbox((prev) => {
            const matchIndex = prev.findIndex(
              (item) =>
                item.status === "sending" &&
                item.chatId === event.conversationId &&
                item.type === event.message!.type,
            );
            if (matchIndex < 0) return prev;
            const matched = prev[matchIndex]!;
            persistE2ePlaintextCache({ [event.message!.id]: matched.content });
            return prev.filter((_, index) => index !== matchIndex);
          });
        } else {
          setOutbox((prev) => removeMatchingSendingOutboxItem(prev, event.message!));
        }
      } else {
        socketRef.current?.emit("messages:delivered", { messageId: event.message.id });
        const isActiveConversation = activeConversationIdsRef.current.has(event.conversationId);
        const isMutedConversation = Boolean(
          queryClient
            .getQueryData<ConversationsPage>(["conversations"])
            ?.conversations.find((conversation) => conversation.id === event.conversationId)?.isMuted ||
            localMutedConversationIdsRef.current.includes(event.conversationId),
        );
        if (currentUser?.settings.notificationSoundEnabled !== false && !isMutedConversation) {
          if (isActiveConversation) {
            playChatIncomingSoundRef.current?.();
          } else {
            playConversationListSoundRef.current?.();
          }
        }
      }
      if (currentUser?.id) {
        const isActiveConversation = activeConversationIdsRef.current.has(event.conversationId);
        const hasConversationSummary = Boolean(
          queryClient
            .getQueryData<ConversationsPage>(["conversations"])
            ?.conversations.some((conversation) => conversation.id === event.conversationId),
        );
        if (!hasConversationSummary) {
          void queryClient.invalidateQueries({ queryKey: ["conversations"] });
        }
        queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
          conversations: updateConversationSummaryWithMessage(
            current?.conversations ?? [],
            isActiveConversation
              ? {
                  ...event.message!,
                  receipts: upsertReceipt(event.message!.receipts, {
                    messageId: event.message!.id,
                    conversationId: event.message!.conversationId,
                    userId: currentUser.id,
                    deliveredAt: new Date().toISOString(),
                    readAt: new Date().toISOString(),
                  }),
                }
              : event.message!,
            currentUser.id,
            isActiveConversation,
          ),
        }));
      }
    });

    socket.on("message.deleted", (event?: RealtimeSocketEvent) => {
      if (!event?.conversationId || !event.messageId) {
        return;
      }

      const tombstoneContent = encodeDeletedMessageContent();
      queryClient.setQueryData<MessagesPage>(["messages", event.conversationId], (current) => ({
        messages: (current?.messages ?? []).map((message) =>
          message.id === event.messageId
            ? { ...message, content: tombstoneContent, type: "text" }
            : message,
        ),
        nextCursor: current?.nextCursor ?? null,
      }));
      setOutbox((prev) => prev.filter((item) => item.localId !== event.messageId));
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });

    socket.on("message.updated", (event?: RealtimeSocketEvent) => {
      if (!event?.conversationId || !event.message) {
        return;
      }

      if (isE2ePayload(event.message.content) && event.message.senderId !== currentUser?.id) {
        e2eDecryptInflightRef.current.delete(event.message.id);
        e2eDecryptCacheRef.current = Object.fromEntries(
          Object.entries(e2eDecryptCacheRef.current).filter(([id]) => id !== event.message!.id),
        );
        e2eDecryptFailedRef.current = Object.fromEntries(
          Object.entries(e2eDecryptFailedRef.current).filter(([id]) => id !== event.message!.id),
        );
        setE2eDecryptCache(e2eDecryptCacheRef.current);
        setE2eDecryptFailed(e2eDecryptFailedRef.current);
      }

      queryClient.setQueryData<MessagesPage>(["messages", event.conversationId], (current) => ({
        messages: upsertConversationMessage(current?.messages ?? [], event.message!),
        nextCursor: current?.nextCursor ?? null,
      }));
      queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
        conversations: updateConversationSummaryWithEditedMessage(
          current?.conversations ?? [],
          event.message!,
        ),
      }));
    });

    socket.on("message.view_once_consumed", (event?: RealtimeSocketEvent) => {
      if (!event?.conversationId || !event.messageId || !event.userId) {
        return;
      }
      if (event.userId !== currentUser?.id) {
        return;
      }

      const openedContent = encodeViewOnceOpenedContent("image");
      queryClient.setQueryData<MessagesPage>(["messages", event.conversationId], (current) => ({
        messages: (current?.messages ?? []).map((message) =>
          message.id === event.messageId ? { ...message, content: openedContent } : message,
        ),
        nextCursor: current?.nextCursor ?? null,
      }));
    });

    socket.on("message.view_once_screenshot", (event?: RealtimeSocketEvent) => {
      if (!event?.conversationId || !event.messageId) {
        return;
      }

      if (event.message) {
        queryClient.setQueryData<MessagesPage>(["messages", event.conversationId], (current) => ({
          messages: upsertConversationMessage(current?.messages ?? [], event.message!),
          nextCursor: current?.nextCursor ?? null,
        }));
      }

      if (event.messageSenderId === currentUser?.id) {
        Alert.alert(
          "Capture d'écran",
          "Une capture d'écran a été effectuée sur votre photo à vue unique.",
        );
      }
    });

    socket.on("message.reaction", (event?: RealtimeSocketEvent) => {
      if (!event?.conversationId || !event.messageId || !event.reactions) {
        return;
      }

      queryClient.setQueryData<MessagesPage>(["messages", event.conversationId], (current) => ({
        messages: (current?.messages ?? []).map((message) =>
          message.id === event.messageId
            ? { ...message, reactions: event.reactions }
            : message,
        ),
        nextCursor: current?.nextCursor ?? null,
      }));
    });

    socket.on("message.receipt", (event?: RealtimeSocketEvent) => {
      if (!event?.conversationId || !event.receipt) {
        return;
      }

      queryClient.setQueryData<MessagesPage>(["messages", event.conversationId], (current) => {
        if (!current) {
          return { messages: [], nextCursor: null };
        }

        return {
          ...current,
          messages: applyReceiptToMessages(current.messages, event.receipt!),
        };
      });
      queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
        conversations: updateConversationSummaryWithReceipt(
          current?.conversations ?? [],
          event.receipt!,
        ),
      }));
    });

    socket.on("conversation.created", () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });
    socket.on("conversation.updated", (event?: RealtimeSocketEvent) => {
      if (!event?.conversation) return;
      queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
        conversations: upsertConversationSummary(
          current?.conversations ?? [],
          event.conversation!,
        ),
      }));
    });
    socket.on("conversation.deleted", (event?: RealtimeSocketEvent) => {
      if (!event?.conversationId) return;

      queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
        conversations: (current?.conversations ?? []).filter(
          (conversation) => conversation.id !== event.conversationId,
        ),
      }));
      queryClient.removeQueries({ queryKey: ["messages", event.conversationId] });
      setLoadedConversationIds((prev) => prev.filter((id) => id !== event.conversationId));
    });
    socket.on("group.member_invited", (event?: RealtimeSocketEvent) => {
      if (!event?.groupMemberInvite) return;
      setPendingGroupInvites((prev) => {
        if (prev.some((invite) => invite.id === event.groupMemberInvite!.id)) {
          return prev;
        }
        return [event.groupMemberInvite!, ...prev];
      });
    });
    socket.on("member.added", (event?: RealtimeSocketEvent) => {
      if (!event?.conversation) {
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
        return;
      }
      queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
        conversations: upsertConversationSummary(
          current?.conversations ?? [],
          event.conversation!,
        ),
      }));
    });
    socket.on("member.removed", (event?: RealtimeSocketEvent) => {
      if (!event?.conversationId) return;

      if (event.removedUserId === currentUser?.id) {
        queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
          conversations: (current?.conversations ?? []).filter(
            (conversation) => conversation.id !== event.conversationId,
          ),
        }));
        queryClient.removeQueries({ queryKey: ["messages", event.conversationId] });
        return;
      }

      if (event.conversation) {
        queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
          conversations: upsertConversationSummary(
            current?.conversations ?? [],
            event.conversation!,
          ),
        }));
      } else {
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
    });
    socket.on("presence.updated", (event?: RealtimeSocketEvent) => {
      const userId = event?.presence?.userId;
      const snapshot = event?.presence?.snapshot;
      if (!userId || !snapshot) return;

      queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => {
        if (!current) return current;
        return {
          conversations: patchParticipantPresence(current.conversations, userId, snapshot),
        };
      });
    });
    socket.on("story.created", (event?: RealtimeSocketEvent) => {
      if (event?.story) {
        queryClient.setQueryData<{ stories: GStory[] }>(["stories"], (current) => {
          const existing = current?.stories ?? [];
          if (existing.some((story) => story.id === event.story!.id)) {
            return current ?? { stories: existing };
          }
          return { stories: [event.story!, ...existing] };
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["stories"] });
    });
    socket.on("call.invited", (event?: RealtimeSocketEvent) => {
      if (
        !event?.conversationId ||
        !event.callerUserId ||
        !event.callType ||
        !event.callId ||
        event.callerUserId === currentUser?.id ||
        !shouldAcceptIncomingCall(event.callId)
      ) {
        return;
      }

      setIncomingCall({
        callId: event.callId,
        conversationId: event.conversationId,
        callerUserId: event.callerUserId,
        callerName: event.callerName ?? "Contact",
        callerAvatarUrl: event.callerAvatarUrl ?? null,
        callType: event.callType,
      });
    });

    const handleCallSignal = (
      type: "cancelled" | "declined" | "ended" | "missed",
      event?: RealtimeSocketEvent,
    ) => {
      if (!event?.callId || !event.conversationId) return;
      clearIncomingCallIfMatches(event.callId);
      emitCallSignal({
        type,
        callId: event.callId,
        conversationId: event.conversationId,
      });

      const outcome =
        type === "missed"
          ? ("missed" as const)
          : type === "cancelled"
            ? ("cancelled" as const)
            : type === "declined"
              ? ("declined" as const)
              : ("completed" as const);

      const refreshConversation = () => {
        void queryClient.invalidateQueries({ queryKey: ["messages", event.conversationId] });
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      };

      if (authToken && event.callerUserId) {
        void logConversationCall(
          {
            callId: event.callId,
            conversationId: event.conversationId,
            callerUserId: event.callerUserId,
            callType: event.callType ?? "audio",
            outcome,
          },
          authToken,
        )
          .catch(() => undefined)
          .finally(refreshConversation);
      } else {
        refreshConversation();
      }

      if (
        (type === "missed" || type === "cancelled") &&
        event.callerUserId &&
        event.callerUserId !== currentUser?.id &&
        event.conversationId &&
        event.callId
      ) {
        const callLogId = `calllog_${event.callId}`;
        setCalls((prev) => {
          if (prev.some((call) => call.id === callLogId)) return prev;
          return [
            {
              id: callLogId,
              userId: event.callerUserId!,
              conversationId: event.conversationId,
              type: event.callType ?? "audio",
              direction: "incoming" as const,
              missed: true,
              failed: false,
              duration: null,
              timestamp: new Date().toISOString(),
            },
            ...prev,
          ].slice(0, 200);
        });
      }
    };

    socket.on("call.cancelled", (event?: RealtimeSocketEvent) => {
      handleCallSignal("cancelled", event);
    });
    socket.on("call.declined", (event?: RealtimeSocketEvent) => {
      handleCallSignal("declined", event);
    });
    socket.on("call.ended", (event?: RealtimeSocketEvent) => {
      handleCallSignal("ended", event);
    });
    socket.on("call.missed", (event?: RealtimeSocketEvent) => {
      handleCallSignal("missed", event);
    });
    socket.on("call.answered", (event?: RealtimeSocketEvent) => {
      if (!event?.callId || !event.conversationId) return;
      emitCallSignal({
        type: "answered",
        callId: event.callId,
        conversationId: event.conversationId,
      });
    });
    socket.on(
      "typing.updated",
      (payload?: { conversationId?: string; userId?: string; isTyping?: boolean }) => {
        if (!payload?.conversationId || !payload.userId || payload.userId === currentUser?.id) {
          return;
        }

        const timeoutKey = `${payload.conversationId}:${payload.userId}`;
        if (typingTimeoutsRef.current[timeoutKey]) {
          clearTimeout(typingTimeoutsRef.current[timeoutKey]);
          delete typingTimeoutsRef.current[timeoutKey];
        }

        setTypingByConversation((prev) => {
          const current = new Set(prev[payload.conversationId!] ?? []);
          if (payload.isTyping) {
            current.add(payload.userId!);
          } else {
            current.delete(payload.userId!);
          }
          return {
            ...prev,
            [payload.conversationId!]: Array.from(current),
          };
        });

        if (payload.isTyping) {
          typingTimeoutsRef.current[timeoutKey] = setTimeout(() => {
            setTypingByConversation((prev) => ({
              ...prev,
              [payload.conversationId!]: (prev[payload.conversationId!] ?? []).filter(
                (userId) => userId !== payload.userId,
              ),
            }));
            delete typingTimeoutsRef.current[timeoutKey];
          }, 3500);
        }
      },
    );
        })
        .catch((error) => {
          if (__DEV__) {
            console.warn("[Gbairai] socket module failed:", error);
          }
        });

    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [authToken, currentUser?.id, queryClient]);

  useEffect(() => {
    if (!authToken || socketConnected) {
      return;
    }

    const poll = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["stories"] });
      for (const chatId of loadedConversationIdsRef.current) {
        void queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      }
    }, 20_000);

    return () => clearInterval(poll);
  }, [authToken, socketConnected, queryClient]);

  useEffect(() => {
    if (!authToken || !currentUser?.settings.notificationsEnabled) return;

    const syncPushToken = async () => {
      try {
        const { registerForPushNotificationsAsync } = await import("@/lib/notifications");
        const pushToken = await registerForPushNotificationsAsync();
        if (!pushToken) return;

        try {
          await registerPushDevice(pushToken, "Expo device");
        } catch (error) {
          if (__DEV__) {
            console.warn("[Gbairai] enregistrement push échoué", error);
          }
        }

        const { prepareVoipPushListeners } = await import("@/lib/voip-push");
        if (__DEV__) {
          console.log("[Gbairai] push Expo enregistré");
        }
        prepareVoipPushListeners((voipToken) => {
          void registerPushDevice(pushToken, "Expo device", voipToken).catch((error) => {
            if (__DEV__) {
              console.warn("[Gbairai] enregistrement VoIP échoué", error);
            }
          });
        });
      } catch (error) {
        if (__DEV__) {
          console.warn("[Gbairai] permissions push échouées", error);
        }
      }
    };

    void syncPushToken();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncPushToken();
      }
    });

    return () => subscription.remove();
  }, [authToken, currentUser?.settings.notificationsEnabled, registerPushDevice]);

  useEffect(() => {
    if (!authToken || !currentUser?.id) return;

    let cancelled = false;

    const pollIncomingCall = async () => {
      try {
        const pending = await fetchPendingIncomingCall(authToken);
        if (cancelled || !pending || pending.callerUserId === currentUser.id) return;
        if (!shouldAcceptIncomingCall(pending.callId)) return;

        const existing = getIncomingCall();
        if (existing?.callId === pending.callId) return;

        setIncomingCall({
          callId: pending.callId,
          conversationId: pending.conversationId,
          callerUserId: pending.callerUserId,
          callerName: pending.callerName,
          callerAvatarUrl: pending.callerAvatarUrl ?? null,
          callType: pending.callType,
        });
      } catch {
        // Best effort: socket reste le canal principal.
      }
    };

    void pollIncomingCall();
    const interval = setInterval(() => {
      void pollIncomingCall();
    }, 3_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authToken, currentUser?.id]);

  useEffect(() => {
    if (!authToken) {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }
      return;
    }

    const sendPresence = (isOnline: boolean) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("presence:heartbeat", { isOnline });
        return;
      }
      void updatePresenceHeartbeat({ isOnline });
    };

    const handleAppStateChange = (state: AppStateStatus) => {
      appStateRef.current = state;
      sendPresence(state === "active");
    };

    sendPresence(appStateRef.current === "active");
    presenceIntervalRef.current = setInterval(
      () => sendPresence(appStateRef.current === "active"),
      ONLINE_PRESENCE_INTERVAL,
    );
    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }
    };
  }, [authToken]);

  useEffect(() => {
    void flushOutbox();
  }, [authToken]);

  useEffect(() => {
    if (isAuthenticated) return;
    resetContactsSyncState();
    setTypingByConversation({});
    setE2eDecryptCache({});
    setE2eDecryptFailed({});
    setE2eReady(false);
    resetE2eBootstrapCache();
    e2eDecryptCacheRef.current = {};
    e2eDecryptFailedRef.current = {};
    e2eDecryptInflightRef.current.clear();
    e2eDecryptWarnedRef.current.clear();
    lastReadMessageByChatRef.current = {};
    activeConversationIdsRef.current.clear();
  }, [isAuthenticated]);

  useEffect(() => {
    e2eDecryptCacheRef.current = e2eDecryptCache;
  }, [e2eDecryptCache]);

  useEffect(() => {
    if (!isAuthenticated || !localStorageReady || !currentUser?.id) return;
    let cancelled = false;
    void (async () => {
      const raw = await safeGetItem(e2ePlaintextCacheKey(currentUser.id));
      if (!raw || cancelled) return;
      try {
        const cached = JSON.parse(raw) as Record<string, string>;
        e2eDecryptCacheRef.current = trimE2ePlaintextCache({
          ...e2eDecryptCacheRef.current,
          ...cached,
        });
        setE2eDecryptCache(e2eDecryptCacheRef.current);
      } catch {
        // Cache local best-effort : un contenu invalide sera simplement ignoré.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, isAuthenticated, localStorageReady]);

  useEffect(() => {
    e2eDecryptFailedRef.current = e2eDecryptFailed;
  }, [e2eDecryptFailed]);

  const persistE2ePlaintextCache = useCallback(
    (updates: Record<string, string>) => {
      if (!currentUser?.id || !Object.keys(updates).length) return;
      const userId = currentUser.id;
      e2eDecryptCacheRef.current = trimE2ePlaintextCache({
        ...e2eDecryptCacheRef.current,
        ...updates,
      });
      setE2eDecryptCache(e2eDecryptCacheRef.current);
      void (async () => {
        let stored: Record<string, string> = {};
        const raw = await safeGetItem(e2ePlaintextCacheKey(userId));
        if (raw) {
          try {
            stored = JSON.parse(raw) as Record<string, string>;
          } catch {
            stored = {};
          }
        }
        await safeSetItem(
          e2ePlaintextCacheKey(userId),
          JSON.stringify(trimE2ePlaintextCache({ ...stored, ...updates })),
        );
      })();
    },
    [currentUser?.id],
  );

  useEffect(() => {
    if (!isE2eEnabled() || !authToken || !currentUser?.id) return;
    void ensureE2eDeviceRegistered(currentUser.id, { forceRegister: true })
      .then((keys) => {
        if (keys) {
          e2eDecryptInflightRef.current.clear();
          setE2eReady(true);
        }
      })
      .catch((error) => {
        if (__DEV__) {
          console.warn("[Gbairai] E2E bootstrap:", error);
        }
      });
  }, [authToken, currentUser?.id]);

  const conversationSummaries = conversationsQuery.data?.conversations ?? [];

  const conversationById = useMemo(() => {
    const map = new Map<string, ConversationSummary>();
    for (const conversation of conversationSummaries) {
      map.set(conversation.id, conversation);
    }
    return map;
  }, [conversationSummaries]);

  const users = useMemo(() => {
    const nextUsers: Record<string, GUser> = {};
    for (const conversation of conversationSummaries) {
      for (const participant of conversation.participants) {
        nextUsers[participant.userId] = {
          id: participant.profile.id,
          name: participant.profile.name,
          phone: participant.profile.phone,
          avatar: participant.profile.avatarUrl,
          bio: participant.profile.bio,
          status: participant.profile.statusText,
          lastSeen: participant.profile.presence.isOnline
            ? null
            : participant.profile.presence.lastSeenAt,
          initials: participant.profile.initials,
          color: participant.profile.color,
        };
      }
    }

    if (currentUser) {
      nextUsers[currentUser.id] = {
        id: currentUser.id,
        name: currentUser.name,
        phone: currentUser.phone,
        avatar: currentUser.avatar,
        bio: currentUser.bio,
        status: currentUser.statusText,
        lastSeen: currentUser.presence.isOnline ? null : currentUser.presence.lastSeenAt,
        initials: currentUser.name.slice(0, 2).toUpperCase(),
        color: "#6D4AFF",
      };
    }

    for (const contact of composeContactsSnapshot) {
      if (!contact.userId || nextUsers[contact.userId]) {
        continue;
      }
      nextUsers[contact.userId] = {
        id: contact.userId,
        name: contact.name,
        phone: contact.phone,
        avatar: contact.avatar,
        bio: contact.bio,
        status: contact.status,
        lastSeen: contact.lastSeen,
        initials: contact.initials,
        color: contact.color,
      };
    }

    for (const story of storiesQuery.data?.stories ?? []) {
      if (nextUsers[story.userId]) {
        continue;
      }
      const contact = composeContactsSnapshot.find((item) => item.userId === story.userId);
      nextUsers[story.userId] = contact?.userId
        ? {
            id: contact.userId,
            name: contact.name,
            phone: contact.phone,
            avatar: contact.avatar,
            bio: contact.bio,
            status: contact.status,
            lastSeen: contact.lastSeen,
            initials: contact.initials,
            color: contact.color,
          }
        : {
            id: story.userId,
            name: "Contact",
            phone: "",
            avatar: null,
            bio: "",
            status: "",
            lastSeen: null,
            initials: "?",
            color: "#6D4AFF",
          };
    }

    return isAuthenticated ? nextUsers : { ...MOCK_USERS, ...nextUsers };
  }, [composeContactsSnapshot, conversationSummaries, currentUser, isAuthenticated, storiesQuery.data?.stories]);

  const toMessageStatus = (
    message: ConversationMessage,
    currentUserId: string,
  ): MessageStatus => {
    if (message.senderId !== currentUserId) {
      return "delivered";
    }

    const recipientReceipts = message.receipts.filter(
      (receipt) => receipt.userId !== currentUserId,
    );
    if (recipientReceipts.some((receipt) => receipt.readAt)) return "read";
    if (
      recipientReceipts.length > 0 &&
      recipientReceipts.every((receipt) => receipt.deliveredAt)
    ) {
      return "delivered";
    }
    return "sent";
  };

  const chats = useMemo<GChat[]>(
    () => {
      if (isAuthenticated) {
        return conversationSummaries.map((conversation) => {
          const extended = conversation as ExtendedConversationSummary;
          return {
            id: conversation.id,
            type: conversation.type,
            participantIds: conversation.participants.map((participant) => participant.userId),
            name: conversation.title ?? undefined,
            avatarUrl: conversation.avatarUrl,
            createdBy: conversation.createdBy,
            unreadCount: conversation.unreadCount,
            isArchived: Boolean(extended.isArchived),
            isMuted: Boolean(extended.isMuted || localMutedConversationIds.includes(conversation.id)),
            groupSettings:
              conversation.type === "group"
                ? parseGroupSettings(
                    (conversation as ConversationSummary & { groupSettings?: unknown }).groupSettings,
                  )
                : undefined,
            lastMessage:
              conversation.lastMessage && currentUser
                ? toGMessage(
                    conversation.lastMessage,
                    currentUser.id,
                    toMessageStatus,
                    e2eDecryptCache[conversation.lastMessage.id],
                    e2eDecryptFailed[conversation.lastMessage.id],
                  )
                : undefined,
          };
        });
      }

      return INITIAL_CHATS;
    },
    [
      conversationSummaries,
      currentUser,
      e2eDecryptCache,
      e2eDecryptFailed,
      isAuthenticated,
      localMutedConversationIds,
    ],
  );

  const messages = useMemo<Record<string, GMessage[]>>(() => {
    const record: Record<string, GMessage[]> = isAuthenticated
      ? {}
      : { ...INITIAL_MESSAGES };

    for (const [index, query] of messageQueries.entries()) {
      const page = query.data;
      if (!page || !currentUser) continue;
      const chatId = knownConversationIds[index];
      if (!chatId) continue;
      record[chatId] = page.messages
        .filter(
          (message) =>
            !isPendingE2eDecrypt(message, e2eDecryptCache[message.id], e2eDecryptFailed[message.id]),
        )
        .map((message) =>
          toGMessage(
            message,
            currentUser.id,
            toMessageStatus,
            e2eDecryptCache[message.id],
            e2eDecryptFailed[message.id],
          ),
        );
    }

    for (const item of outbox) {
      const extracted =
        item.type === "text"
          ? extractReplyFromContent(item.content)
          : { body: item.content, replyTo: null };
      record[item.chatId] = [
        ...(record[item.chatId] ?? []),
        {
          id: item.localId,
          chatId: item.chatId,
          senderId: currentUserId,
          content:
            item.type === "text"
              ? getMessageDisplayContent(extracted.body).displayContent
              : item.content,
          type: item.type,
          status: item.status,
          timestamp: item.createdAt,
          replyTo: item.replyTo ?? extracted.replyTo ?? undefined,
          reactions: [],
        },
      ];
      record[item.chatId] = sortGMessages(record[item.chatId] ?? []);
    }

    return record;
  }, [
    currentUser,
    currentUserId,
    e2eDecryptCache,
    e2eDecryptFailed,
    isAuthenticated,
    knownConversationIds,
    messageQueries,
    outbox,
  ]);

  useEffect(() => {
    if (!isE2eEnabled() || !currentUser?.id || !e2eReady) return;

    const pendingById = new Map<
      string,
      {
        id: string;
        content: string;
        senderId: string;
        conversationId: string;
        createdAt: string;
      }
    >();
    const selfEncryptedIds: string[] = [];

    const collect = (message: {
      id: string;
      content: string;
      senderId: string;
      conversationId: string;
      createdAt: string;
    }) => {
      if (!isE2ePayload(message.content)) return;
      if (e2eDecryptCacheRef.current[message.id]) return;
      if (e2eDecryptFailedRef.current[message.id]) return;
      if (message.senderId === currentUser.id) {
        selfEncryptedIds.push(message.id);
        return;
      }
      if (e2eDecryptInflightRef.current.has(message.id)) return;
      pendingById.set(message.id, message);
    };

    for (const conversation of conversationSummaries) {
      const lastMessage = conversation.lastMessage;
      if (!lastMessage) continue;
      collect({ ...lastMessage, conversationId: conversation.id });
    }

    for (const query of messageQueries) {
      const page = query.data;
      if (!page) continue;
      for (const message of page.messages) {
        collect(message);
      }
    }

    if (selfEncryptedIds.length) {
      setE2eDecryptFailed((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const messageId of selfEncryptedIds) {
          if (next[messageId]) continue;
          next[messageId] = true;
          e2eDecryptFailedRef.current[messageId] = true;
          changed = true;
        }
        return changed ? next : prev;
      });
    }

    if (!pendingById.size) return;

    // Ordre chronologique : l'enveloppe « init » qui établit la session
    // doit être déchiffrée avant les messages « msg » qui en dépendent.
    const pending = [...pendingById.values()].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );

    let cancelled = false;
    void (async () => {
      for (const item of pending) {
        if (cancelled) break;
        e2eDecryptInflightRef.current.add(item.id);
        try {
          const sessionPeerUserId = resolveE2eSessionPeerUserId(
            item.conversationId,
            item.senderId,
            currentUser.id,
            conversationById,
          );
          if (!sessionPeerUserId) {
            continue;
          }
          const result = await tryDecryptDirectTextMessage(
            currentUser.id,
            sessionPeerUserId,
            item.content,
          );
          if (result === E2E_FALLBACK_LABEL) {
            if (__DEV__ && !e2eDecryptWarnedRef.current.has(item.id)) {
              e2eDecryptWarnedRef.current.add(item.id);
              console.warn("[Gbairai] E2E: message indéchiffrable, affichage de secours", {
                messageId: item.id,
                sessionPeerUserId,
              });
            }
            e2eDecryptFailedRef.current = {
              ...e2eDecryptFailedRef.current,
              [item.id]: true,
            };
            setE2eDecryptFailed((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: true }));
            continue;
          }
          persistE2ePlaintextCache({ [item.id]: result });
        } finally {
          e2eDecryptInflightRef.current.delete(item.id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    conversationById,
    conversationSummaries,
    currentUser?.id,
    e2eReady,
    messageQueries,
  ]);

  const maybeEncryptTextPayload = useCallback(
    async (chatId: string, content: string, messageType: string) => {
      if (!shouldEncryptDirectText(conversationById.get(chatId)?.type ?? "", messageType)) {
        return content;
      }
      const conversation = conversationById.get(chatId);
      if (!conversation || !currentUser?.id) return content;
      const peerUserId = getDirectPeerUserId(conversation, currentUser.id);
      if (!peerUserId) return content;
      try {
        return await encryptDirectTextMessage(currentUser.id, peerUserId, content);
      } catch (error) {
        if (__DEV__) {
          console.warn("[Gbairai] E2E encrypt échoué — envoi en clair:", error);
        }
        return content;
      }
    },
    [conversationById, currentUser?.id],
  );

  const sendMessage = (
    chatId: string,
    content: string,
    options?: { replyTo?: MessageReplyRef },
  ) => {
    const serialized = options?.replyTo
      ? encodeTextMessageContent(content, options.replyTo)
      : content;
    const payload = {
      localId: `local_${Date.now()}`,
      chatId,
      content: serialized,
      type: "text" as const,
      createdAt: new Date().toISOString(),
      status: "sending" as const,
      replyTo: options?.replyTo,
    };

    const sendNow = async () => {
      setOutbox((prev) => [...prev, payload]);
      try {
        const wireContent = await maybeEncryptTextPayload(chatId, serialized, "text");
        const sentMessage = await sendConversationMessage(chatId, {
          content: wireContent,
          type: "text",
        });
        queryClient.setQueryData<MessagesPage>(["messages", chatId], (current) => ({
          messages: upsertConversationMessage(current?.messages ?? [], sentMessage),
          nextCursor: current?.nextCursor ?? null,
        }));
        if (isE2ePayload(wireContent)) {
          persistE2ePlaintextCache({ [sentMessage.id]: serialized });
        }
        setOutbox((prev) => prev.filter((item) => item.localId !== payload.localId));
      } catch {
        setOutbox((prev) =>
          prev.map((item) =>
            item.localId === payload.localId ? { ...item, status: "failed" } : item,
          ),
        );
      }
    };

    setTypingByConversation((prev) => ({
      ...prev,
      [chatId]: (prev[chatId] ?? []).filter((userId) => userId !== currentUserId),
    }));
    socketRef.current?.emit("typing:update", { conversationId: chatId, isTyping: false });
    void sendNow();
  };

  const sendEmoji3dMessage = (
    chatId: string,
    payload: import("@/lib/emoji-messages").Emoji3dMessagePayload,
  ) => {
    sendMessage(chatId, encodeEmoji3dMessagePayload(payload));
  };

  const sendAudioMessage = (
    chatId: string,
    payload: { url: string; key: string; durationSeconds: number; mimeType: string },
  ) => {
    const serialized = encodeAudioMessagePayload(payload);
    const queuedPayload = {
      localId: `local_${Date.now()}`,
      chatId,
      content: serialized,
      type: "audio" as const,
      createdAt: new Date().toISOString(),
      status: "sending" as const,
    };

    const sendNow = async () => {
      setOutbox((prev) => [...prev, queuedPayload]);
      try {
        const sentMessage = await sendConversationMessage(chatId, {
          content: serialized,
          type: "audio",
        });
        queryClient.setQueryData<MessagesPage>(["messages", chatId], (current) => ({
          messages: upsertConversationMessage(current?.messages ?? [], sentMessage),
          nextCursor: current?.nextCursor ?? null,
        }));
        setOutbox((prev) => prev.filter((item) => item.localId !== queuedPayload.localId));
      } catch {
        setOutbox((prev) =>
          prev.map((item) =>
            item.localId === queuedPayload.localId ? { ...item, status: "failed" } : item,
          ),
        );
      }
    };

    void sendNow();
  };

  const sendImageMessage = (
    chatId: string,
    payload: { url: string; key: string; mimeType: string; width?: number; height?: number; viewOnce?: boolean },
  ) => {
    const serialized = encodeImageMessagePayload(payload);
    const queuedPayload = {
      localId: `local_${Date.now()}`,
      chatId,
      content: serialized,
      type: "image" as const,
      createdAt: new Date().toISOString(),
      status: "sending" as const,
    };

    const sendNow = async () => {
      setOutbox((prev) => [...prev, queuedPayload]);
      try {
        const sentMessage = await sendConversationMessage(chatId, {
          content: serialized,
          type: "image",
        });
        queryClient.setQueryData<MessagesPage>(["messages", chatId], (current) => ({
          messages: upsertConversationMessage(current?.messages ?? [], sentMessage),
          nextCursor: current?.nextCursor ?? null,
        }));
        setOutbox((prev) => prev.filter((item) => item.localId !== queuedPayload.localId));
      } catch {
        setOutbox((prev) =>
          prev.map((item) =>
            item.localId === queuedPayload.localId ? { ...item, status: "failed" } : item,
          ),
        );
      }
    };

    void sendNow();
  };

  const sendVideoMessage = (
    chatId: string,
    payload: {
      url: string;
      key: string;
      mimeType: string;
      durationSeconds?: number;
      thumbnailKey?: string;
      thumbnailUrl?: string;
    },
  ) => {
    const serialized = encodeVideoMessagePayload(payload);
    const queuedPayload = {
      localId: `local_${Date.now()}`,
      chatId,
      content: serialized,
      type: "video" as const,
      createdAt: new Date().toISOString(),
      status: "sending" as const,
    };

    const sendNow = async () => {
      setOutbox((prev) => [...prev, queuedPayload]);
      try {
        const sentMessage = await sendConversationMessage(chatId, {
          content: serialized,
          type: "video",
        });
        queryClient.setQueryData<MessagesPage>(["messages", chatId], (current) => ({
          messages: upsertConversationMessage(current?.messages ?? [], sentMessage),
          nextCursor: current?.nextCursor ?? null,
        }));
        setOutbox((prev) => prev.filter((item) => item.localId !== queuedPayload.localId));
      } catch {
        setOutbox((prev) =>
          prev.map((item) =>
            item.localId === queuedPayload.localId ? { ...item, status: "failed" } : item,
          ),
        );
      }
    };

    void sendNow();
  };

  const reactToMessage = async (chatId: string, messageId: string, emoji: string) => {
    if (!authToken || !currentUser?.id) {
      throw new Error("Session expirée");
    }
    if (messageId.startsWith("local_")) {
      throw new Error("Attendez que le message soit envoyé avant d'ajouter une réaction.");
    }

    const previousPage = queryClient.getQueryData<MessagesPage>(["messages", chatId]);
    const target = previousPage?.messages.find((message) => message.id === messageId) as
      | (ConversationMessage & { reactions?: MessageReactionSummary[] })
      | undefined;
    const currentReactions = target?.reactions ?? [];
    const myReaction = currentReactions.find((reaction) => reaction.reactedByMe);
    const nextEmoji = myReaction?.emoji === emoji ? null : emoji;

    const optimisticReactions = (() => {
      const list = currentReactions.map((reaction) => ({
        ...reaction,
        userIds: [...reaction.userIds],
      }));

      if (myReaction) {
        const prevIndex = list.findIndex((reaction) => reaction.emoji === myReaction.emoji);
        if (prevIndex >= 0) {
          const entry = list[prevIndex]!;
          entry.userIds = entry.userIds.filter((userId) => userId !== currentUser.id);
          entry.count = entry.userIds.length;
          entry.reactedByMe = false;
          if (entry.count === 0) {
            list.splice(prevIndex, 1);
          }
        }
      }

      if (nextEmoji) {
        const nextIndex = list.findIndex((reaction) => reaction.emoji === nextEmoji);
        if (nextIndex >= 0) {
          const entry = list[nextIndex]!;
          entry.userIds = [...entry.userIds, currentUser.id];
          entry.count = entry.userIds.length;
          entry.reactedByMe = true;
        } else {
          list.push({
            emoji: nextEmoji,
            count: 1,
            userIds: [currentUser.id],
            reactedByMe: true,
          });
        }
      }

      return list;
    })();

    queryClient.setQueryData<MessagesPage>(["messages", chatId], (current) => ({
      messages: (current?.messages ?? []).map((message) =>
        message.id === messageId ? { ...message, reactions: optimisticReactions } : message,
      ),
      nextCursor: current?.nextCursor ?? null,
    }));

    try {
      const result = await setMessageReaction(messageId, nextEmoji);
      if (result.reactions) {
        queryClient.setQueryData<MessagesPage>(["messages", chatId], (current) => ({
          messages: (current?.messages ?? []).map((message) =>
            message.id === messageId ? { ...message, reactions: result.reactions } : message,
          ),
          nextCursor: current?.nextCursor ?? null,
        }));
      }
    } catch (error) {
      if (previousPage) {
        queryClient.setQueryData(["messages", chatId], previousPage);
      }
      throw error;
    }
  };

  const deleteMessage = async (chatId: string, messageId: string) => {
    const previousMessages = queryClient.getQueryData<MessagesPage>(["messages", chatId]);
    const tombstoneContent = encodeDeletedMessageContent();
    queryClient.setQueryData<MessagesPage>(["messages", chatId], (current) => ({
      messages: (current?.messages ?? []).map((message) =>
        message.id === messageId
          ? { ...message, content: tombstoneContent, type: "text" }
          : message,
      ),
      nextCursor: current?.nextCursor ?? null,
    }));

    try {
      const updatedMessage = await customFetch<ConversationMessage>(`/api/messages/${messageId}`, {
        method: "DELETE",
      });
      queryClient.setQueryData<MessagesPage>(["messages", chatId], (current) => ({
        messages: upsertConversationMessage(current?.messages ?? [], updatedMessage),
        nextCursor: current?.nextCursor ?? null,
      }));
      queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
        conversations: updateConversationSummaryWithEditedMessage(
          current?.conversations ?? [],
          updatedMessage,
        ),
      }));
      await persistMessagesToLocalDb(chatId, [updatedMessage]);
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (error) {
      if (previousMessages) {
        queryClient.setQueryData(["messages", chatId], previousMessages);
      }
      throw error;
    }
  };

  const consumeViewOnceMessage = useCallback(async (chatId: string, messageId: string) => {
    const openedContent = encodeViewOnceOpenedContent("image");
    queryClient.setQueryData<MessagesPage>(["messages", chatId], (current) => ({
      messages: (current?.messages ?? []).map((message) =>
        message.id === messageId ? { ...message, content: openedContent } : message,
      ),
      nextCursor: current?.nextCursor ?? null,
    }));

    try {
      const updatedMessage = await customFetch<ConversationMessage>(
        `/api/messages/${messageId}/view-once/consume`,
        { method: "POST" },
      );
      queryClient.setQueryData<MessagesPage>(["messages", chatId], (current) => ({
        messages: upsertConversationMessage(current?.messages ?? [], updatedMessage),
        nextCursor: current?.nextCursor ?? null,
      }));
      queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
        conversations: updateConversationSummaryWithEditedMessage(
          current?.conversations ?? [],
          updatedMessage,
        ),
      }));
      await persistMessagesToLocalDb(chatId, [updatedMessage]);
    } catch {
      // La mise à jour optimiste reste affichée si l'API échoue déjà.
    }
  }, [queryClient]);

  const reportViewOnceScreenshot = useCallback(async (chatId: string, messageId: string) => {
    try {
      await customFetch<{ messageId: string; conversationId: string }>(
        `/api/messages/${messageId}/view-once/screenshot`,
        { method: "POST" },
      );
    } catch {
      // Ignorer les doublons ou erreurs réseau.
    }
  }, []);

  const editMessage = async (chatId: string, messageId: string, content: string) => {
    const previousMessages = queryClient.getQueryData<MessagesPage>(["messages", chatId]);
    const trimmed = content.trim();
    const editedContent = encodeEditedTextMessageContent(trimmed, new Date().toISOString());
    queryClient.setQueryData<MessagesPage>(["messages", chatId], (current) => ({
      messages: (current?.messages ?? []).map((message) =>
        message.id === messageId ? { ...message, content: editedContent } : message,
      ),
      nextCursor: current?.nextCursor ?? null,
    }));

    try {
      const wireContent = await maybeEncryptTextPayload(chatId, editedContent, "text");
      const updatedMessage = await customFetch<ConversationMessage>(`/api/messages/${messageId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: wireContent }),
      });
      queryClient.setQueryData<MessagesPage>(["messages", chatId], (current) => ({
        messages: upsertConversationMessage(current?.messages ?? [], updatedMessage),
        nextCursor: current?.nextCursor ?? null,
      }));
      if (isE2ePayload(wireContent)) {
        persistE2ePlaintextCache({ [updatedMessage.id]: editedContent });
      }
      queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
        conversations: updateConversationSummaryWithEditedMessage(
          current?.conversations ?? [],
          updatedMessage,
        ),
      }));
      await persistMessagesToLocalDb(chatId, [updatedMessage]);
    } catch (error) {
      if (previousMessages) {
        queryClient.setQueryData(["messages", chatId], previousMessages);
      }
      throw error;
    }
  };

  const setTypingState = (chatId: string, isTyping: boolean) => {
    if (typingEmitStateRef.current[chatId] === isTyping) {
      return;
    }
    typingEmitStateRef.current[chatId] = isTyping;
    const participantUserIds =
      chats.find((chat) => chat.id === chatId)?.participantIds ?? [];
    socketRef.current?.emit("typing:update", {
      conversationId: chatId,
      isTyping,
      participantUserIds,
    });
  };

  const joinConversationRealtime = (chatId: string) => {
    activeConversationIdsRef.current.add(chatId);
    socketRef.current?.emit("conversation:join", { conversationId: chatId });
  };

  const leaveConversationRealtime = (chatId: string) => {
    activeConversationIdsRef.current.delete(chatId);
    delete typingEmitStateRef.current[chatId];
    socketRef.current?.emit("conversation:leave", { conversationId: chatId });
  };

  const markChatAsRead = (chatId: string) => {
    const lastIncomingMessage = [...(messages[chatId] ?? [])]
      .reverse()
      .find((message) => message.senderId !== currentUser?.id);

    if (!lastIncomingMessage) return;
    if (lastReadMessageByChatRef.current[chatId] === lastIncomingMessage.id) return;
    lastReadMessageByChatRef.current[chatId] = lastIncomingMessage.id;
    queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
      conversations: (current?.conversations ?? []).map((conversation) =>
        conversation.id === chatId
          ? {
              ...conversation,
              unreadCount: 0,
              lastReadMessageId: lastIncomingMessage.id,
            }
          : conversation,
      ),
    }));

    const readReceiptsEnabled = currentUser?.settings.readReceiptsEnabled ?? true;

    const mark = async () => {
      if (readReceiptsEnabled) {
        queryClient.setQueryData<MessagesPage>(["messages", chatId], (current) => {
          if (!current || !currentUser?.id) {
            return current;
          }

          const now = new Date().toISOString();
          return {
            ...current,
            messages: current.messages.map((message) => {
              if (
                message.senderId === currentUser.id ||
                message.createdAt > lastIncomingMessage.timestamp
              ) {
                return message;
              }

              return {
                ...message,
                receipts: upsertReceipt(message.receipts, {
                  messageId: message.id,
                  conversationId: chatId,
                  userId: currentUser.id,
                  deliveredAt: now,
                  readAt: now,
                }),
              };
            }),
          };
        });
      }

      if (!readReceiptsEnabled) return;

      if (socketRef.current?.connected) {
        socketRef.current.emit("messages:read", {
          conversationId: chatId,
          messageId: lastIncomingMessage.id,
        });
        return;
      }
      await markConversationRead(chatId, { messageId: lastIncomingMessage.id });
    };

    void mark().catch(() => {
      delete lastReadMessageByChatRef.current[chatId];
    });
  };

  const addStoryView = (storyId: string) => {
    if (isAuthenticated) {
      void customFetch(`/api/stories/${storyId}/views`, { method: "POST" }).then(() => {
        void queryClient.invalidateQueries({ queryKey: ["stories"] });
      });
      return;
    }

    setStories((prev) =>
      prev.map((s) =>
        s.id === storyId && !s.viewerIds.includes(currentUserId)
          ? { ...s, viewerIds: [...s.viewerIds, currentUserId] }
          : s,
      ),
    );
  };

  const replyToStory = async (storyId: string, input: { text?: string; emoji?: string }) => {
    if (!isAuthenticated) {
      throw new Error("Connexion requise pour répondre au statut");
    }
    await customFetch(`/api/stories/${storyId}/replies`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    await queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const createStory = async (
    draft: StoryComposerDraft,
    onUploadStatus?: (status: import("@/lib/upload-status").UploadStatus | null) => void,
  ) => {
    const trimmedText = draft.text.trim();

    if (draft.type === "text") {
      if (!trimmedText) return;
      if (isAuthenticated) {
        await customFetch("/api/stories", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: "text",
            content: trimmedText,
            backgroundColor: draft.backgroundColor || "#6D4AFF",
          }),
        });
        await queryClient.refetchQueries({ queryKey: ["stories"] });
        return;
      }

      setStories((prev) => [
        {
          id: `story_${Date.now()}`,
          userId: currentUserId,
          type: "text",
          content: trimmedText,
          backgroundColor: draft.backgroundColor || "#6D4AFF",
          expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
          viewerIds: [currentUserId],
          createdAt: new Date().toISOString(),
        },
        ...prev.filter((story) => story.userId !== currentUserId),
      ]);
      return;
    }

    if (!draft.mediaUri || !draft.mimeType) {
      throw new Error("Le média du statut est manquant");
    }
    if (!authToken) {
      throw new Error("Session requise pour publier un statut");
    }

    const mediaUri = draft.mediaUri;
    const mimeType = draft.mimeType;
    const category = draft.type === "image" ? "story-image" : "story-video";
    const mediaLabel = draft.type === "image" ? "de la photo" : "de la vidéo";

    const uploaded = await runWithUploadStatus(
      mediaLabel,
      onUploadStatus ?? (() => undefined),
      async (setPhase) => {
        if (draft.type === "image") {
          setPhase("preparing");
          const target = await createMediaUploadTarget(authToken, {
            category,
            mimeType,
          });
          setPhase("uploading");
          await uploadFileToSignedUrl(target.uploadUrl, mediaUri, mimeType, draft.mediaAssetId);
          setPhase("finalizing");
          return {
            url: getDisplayMediaUrl(target.key, target.publicUrl),
            key: target.key,
            mimeType,
            thumbnailUrl: undefined,
          };
        }

        return uploadStoryMediaWithThumbnail(authToken, {
          mediaUri,
          mimeType,
          type: "video",
          assetId: draft.mediaAssetId,
          onPhase: setPhase,
        });
      },
    );

    const content = encodeStoryMediaPayload({
      url: uploaded.url,
      key: uploaded.key,
      mimeType: uploaded.mimeType,
      type: draft.type,
      caption: trimmedText || undefined,
      ...(uploaded.thumbnailUrl ? { thumbnailUrl: uploaded.thumbnailUrl } : {}),
    } as StoryMediaPayload & { caption?: string; thumbnailUrl?: string });

    if (isAuthenticated) {
      await customFetch("/api/stories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: draft.type,
          content,
          backgroundColor: draft.backgroundColor || "#0F172A",
        }),
      });
      await queryClient.refetchQueries({ queryKey: ["stories"] });
      return;
    }

    setStories((prev) => [
      {
        id: `story_${Date.now()}`,
        userId: currentUserId,
        type: draft.type,
        content,
        backgroundColor: draft.backgroundColor || "#0F172A",
        expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
        viewerIds: [currentUserId],
        createdAt: new Date().toISOString(),
      },
      ...prev.filter((story) => story.userId !== currentUserId),
    ]);
  };

  const deleteStory = async (storyId: string) => {
    const previousStories = stories;
    setStories((prev) => prev.filter((story) => story.id !== storyId));
    queryClient.setQueryData<{ stories: GStory[] }>(["stories"], (current) => ({
      stories: (current?.stories ?? []).filter((story) => story.id !== storyId),
    }));

    try {
      if (isAuthenticated) {
        await customFetch(`/api/stories/${storyId}`, { method: "DELETE" });
      }
    } catch (error) {
      setStories(previousStories);
      queryClient.setQueryData(["stories"], { stories: previousStories });
      throw error;
    }
  };

  const loadConversationMessages = async (chatId: string) => {
    setLoadedConversationIds((prev) =>
      prev.includes(chatId) ? prev : [...prev, chatId],
    );

    const page = await queryClient.fetchQuery({
      queryKey: ["messages", chatId],
      queryFn: () => listConversationMessages(chatId, { limit: 100 }),
      staleTime: MESSAGES_STALE_MS,
    });

    if (!currentUser) return;
    const pendingDeliveries = page.messages
      .filter((message) => message.senderId !== currentUser.id)
      .filter((message) =>
        !message.receipts.some(
          (receipt: MessageReceipt) =>
            receipt.userId === currentUser.id && receipt.deliveredAt,
        ),
      );

    for (const message of pendingDeliveries) {
      await markMessageDelivered(message.id);
    }
  };

  const buildImportedContacts = (
    contacts: Array<{ name: string; phone: string }>,
    matches: ContactMatch[],
    defaultCountryCode: string,
  ): ImportedPhoneContact[] => {
    const matchesByPhone = new Map(
      matches.map((match) => [match.phone, match] as const),
    );

    const seen = new Set<string>();
    const builtContacts: ImportedPhoneContact[] = [];

    for (const contact of contacts) {
      try {
        const normalizedPhone = normalizePhoneNumber(contact.phone, defaultCountryCode);
        const match = matchesByPhone.get(normalizedPhone);
        const dedupeKey = `${contact.name}:${normalizedPhone}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        builtContacts.push({
          id: dedupeKey,
          name: contact.name || normalizedPhone,
          phone: normalizedPhone,
          normalizedPhone,
          isRegistered: Boolean(match),
          matchedUser: match?.user,
        });
      } catch {
        // Ignore malformed contact rows.
      }
    }

    return builtContacts.sort((left, right) => left.name.localeCompare(right.name, "fr"));
  };

  const fetchSavedServerContacts = async () => {
    try {
      const response = await customFetch<{
        contacts: Array<{
          phone: string;
          contactName: string;
          userId: string | null;
          source: "phonebook" | "story_reply" | "manual";
        }>;
      }>("/api/contacts");
      return response.contacts ?? [];
    } catch {
      return [];
    }
  };

  const mergeSavedServerContacts = (
    phoneContacts: ComposeContactOption[],
    savedContacts: Awaited<ReturnType<typeof fetchSavedServerContacts>>,
  ) => {
    const phoneNumbers = new Set(phoneContacts.map((contact) => contact.phone));
    const merged = [...phoneContacts];

    for (const saved of savedContacts) {
      if (saved.source === "phonebook" || phoneNumbers.has(saved.phone) || !saved.userId) {
        continue;
      }

      const matchedUser = users[saved.userId];
      merged.push({
        id: `saved:${saved.phone}`,
        userId: saved.userId,
        name: saved.contactName,
        phone: saved.phone,
        avatar: matchedUser?.avatar ?? null,
        initials: initialsFromName(saved.contactName),
        color: matchedUser?.color ?? pickContactColor(saved.phone),
        bio: matchedUser?.bio ?? "",
        status: matchedUser?.status ?? "Sur Gbairai",
        lastSeen: matchedUser?.lastSeen ?? null,
        isRegistered: true,
        contactSource: saved.source,
      });
    }

    return merged.sort((left, right) => {
      if (left.isRegistered !== right.isRegistered) {
        return left.isRegistered ? -1 : 1;
      }
      return left.name.localeCompare(right.name, "fr");
    });
  };

  const syncPhoneContacts = async () => {
    const Contacts = await import("expo-contacts");
    const existingPermission = await Contacts.getPermissionsAsync();

    if (existingPermission.status === "granted") {
      resetContactsPermissionState();
    } else if (existingPermission.canAskAgain === false) {
      markContactsPermissionDenied();
      return [];
    } else {
      const permission = await Contacts.requestPermissionsAsync();
      if (permission.status !== "granted") {
        if (permission.canAskAgain === false) {
          markContactsPermissionDenied();
        }
        return [];
      }
      resetContactsPermissionState();
    }

    const allContacts: ExpoContacts.Contact[] = [];
    let pageOffset = 0;
    let hasNextPage = true;

    while (hasNextPage) {
      const result = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
        pageSize: 500,
        pageOffset,
      });
      allContacts.push(...result.data);
      hasNextPage = result.hasNextPage ?? false;
      pageOffset += result.data.length;
      if (result.data.length === 0) {
        break;
      }
    }

    const defaultCountryCode = currentUser?.countryCode ?? "GN";
    const deviceContacts = allContacts
      .flatMap((contact) =>
        (contact.phoneNumbers ?? []).map((phoneNumber) => ({
          name: getContactDisplayName(contact, phoneNumber.number ?? ""),
          phone: phoneNumber.number ?? "",
        })),
      )
      .filter((item) => item.phone.trim() !== "" && item.name.trim() !== "");

    const dedupedContacts = new Map<string, { name: string; phone: string }>();
    for (const contact of deviceContacts) {
      try {
        const normalizedPhone = normalizePhoneNumber(contact.phone, defaultCountryCode);
        if (!dedupedContacts.has(normalizedPhone)) {
          dedupedContacts.set(normalizedPhone, {
            name: contact.name.trim() || normalizedPhone,
            phone: normalizedPhone,
          });
        }
      } catch {
        // Ignore malformed contact rows.
      }
    }

    const contacts = Array.from(dedupedContacts.values());
    if (!contacts.length) return [];

    try {
      const response = await syncContacts({ contacts });
      return buildImportedContacts(contacts, response.matches, defaultCountryCode);
    } catch {
      // Fallback: always show native phone contacts even if Gbairai detection fails temporarily.
      return buildImportedContacts(contacts, [], defaultCountryCode);
    }
  };

  const getComposeContacts = useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? false;

      if (
        !force &&
        !isContactsPermissionDenied() &&
        composeContactsRef.current.length > 0 &&
        isContactsSyncFresh()
      ) {
        return composeContactsRef.current;
      }

      if (force) {
        resetContactsPermissionState();
      }

      const importedContacts = await runContactsSyncOnce(() => syncPhoneContacts());

      const nextContacts = importedContacts
        .map((contact) => ({
          id: contact.id,
          userId: contact.matchedUser?.id ?? null,
          name: contact.name,
          phone: contact.phone,
          avatar: contact.matchedUser?.avatarUrl ?? null,
          initials: initialsFromName(contact.name),
          color: contact.matchedUser?.color ?? pickContactColor(contact.phone),
          bio: contact.matchedUser?.bio ?? "",
          status: contact.matchedUser?.statusText ?? "Ce numéro n'est pas inscrit sur Gbairai",
          lastSeen: contact.matchedUser?.presence.isOnline
            ? null
            : (contact.matchedUser?.presence.lastSeenAt ?? null),
          isRegistered: contact.isRegistered,
          contactSource: "phonebook" as const,
        }))
        .sort((left, right) => {
          if (left.isRegistered !== right.isRegistered) {
            return left.isRegistered ? -1 : 1;
          }
          return left.name.localeCompare(right.name, "fr");
        });

      const savedContacts = await fetchSavedServerContacts();
      const mergedContacts = mergeSavedServerContacts(nextContacts, savedContacts);

      setComposeContactsSnapshot(mergedContacts);
      composeContactsRef.current = mergedContacts;
      return mergedContacts;
    },
    [currentUser?.countryCode],
  );

  useEffect(() => {
    if (!isAuthenticated || !localStorageReady) {
      return;
    }
    void getComposeContacts();
  }, [getComposeContacts, isAuthenticated, localStorageReady]);

  const updateSavedContactName = async (phone: string, contactName: string) => {
    await customFetch(`/api/contacts/${encodeURIComponent(phone)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contactName }),
    });
    resetContactsSyncState();
    composeContactsRef.current = [];
    await getComposeContacts({ force: true });
  };

  const startConversationWithUser = async (userId: string) => {
    const conversation = await createConversation({
      participantUserIds: [userId],
      participantPhones: [],
      title: null,
    });
    queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
      conversations: upsertConversationSummary(current?.conversations ?? [], conversation),
    }));
    await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    return conversation.id;
  };

  const startConversationWithUsers = async (
    userIds: string[],
    title?: string | null,
    groupSettings?: Partial<import("@/lib/group-settings").GroupSettings>,
  ) => {
    const conversation = await createConversation({
      participantUserIds: userIds,
      participantPhones: [],
      title: title?.trim() ? title.trim() : null,
      ...(groupSettings ? { groupSettings } : {}),
    } as Parameters<typeof createConversation>[0]);
    queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
      conversations: upsertConversationSummary(current?.conversations ?? [], conversation),
    }));
    await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    return conversation.id;
  };

  const applyConversationUpdate = async (conversation: ConversationSummary) => {
    queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
      conversations: upsertConversationSummary(current?.conversations ?? [], conversation),
    }));
    await queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const updateGroup = async (
    conversationId: string,
    input: {
      title?: string | null;
      avatarUrl?: string | null;
      groupSettings?: Partial<import("@/lib/group-settings").GroupSettings>;
    },
  ) => {
    const conversation = await updateConversation(
      conversationId,
      input as Parameters<typeof updateConversation>[1],
    );
    await applyConversationUpdate(conversation);
  };

  const addGroupMembers = async (conversationId: string, userIds: string[]) => {
    const conversation = await addConversationMembers(conversationId, {
      participantUserIds: userIds,
      participantPhones: [],
    });
    await applyConversationUpdate(conversation);
  };

  const removeGroupMember = async (conversationId: string, userId: string) => {
    const conversation = await removeConversationMember(conversationId, userId);
    await applyConversationUpdate(conversation);
  };

  const leaveGroup = async (conversationId: string) => {
    await leaveConversation(conversationId);
    queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
      conversations: (current?.conversations ?? []).filter(
        (conversation) => conversation.id !== conversationId,
      ),
    }));
    queryClient.removeQueries({ queryKey: ["messages", conversationId] });
  };

  const createGroupInviteLink = async (conversationId: string) =>
    createGroupInvite(conversationId);

  const previewGroupInvite = async (inviteToken: string) =>
    getGroupInvitePreview(inviteToken);

  const joinGroupWithInvite = async (inviteToken: string) => {
    const conversation = await joinGroupByInvite({ inviteToken });
    await applyConversationUpdate(conversation);
    return conversation.id;
  };

  const acceptGroupMemberInvite = async (inviteId: string) => {
    setGroupInviteActionId(inviteId);
    try {
      const result = await acceptGroupMemberInviteApi(inviteId);
      await applyConversationUpdate(result.conversation);
      setPendingGroupInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
      return result.conversation.id;
    } finally {
      setGroupInviteActionId(null);
    }
  };

  const declineGroupMemberInvite = async (inviteId: string) => {
    setGroupInviteActionId(inviteId);
    try {
      await declineGroupMemberInviteApi(inviteId);
      setPendingGroupInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
    } finally {
      setGroupInviteActionId(null);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setPendingGroupInvites([]);
      return;
    }
    void listGroupMemberInvites()
      .then((result) => setPendingGroupInvites(result.invites))
      .catch(() => {});
  }, [isAuthenticated, authToken]);

  const getOtherUser = (chat: GChat) => {
    if (chat.type === "group") return undefined;
    const otherId = chat.participantIds.find((id) => id !== currentUserId);
    return otherId ? users[otherId] : undefined;
  };

  const isGroupAdmin = (chat: GChat, userId: string) =>
    chat.type === "group" && chat.createdBy === userId;

  const recordCall = (
    input: Omit<GCall, "id" | "timestamp"> & { id?: string; timestamp?: string },
  ) => {
    const entry: GCall = {
      id: input.id ?? `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: input.timestamp ?? new Date().toISOString(),
      userId: input.userId,
      conversationId: input.conversationId,
      type: input.type,
      direction: input.direction,
      missed: input.missed,
      failed: input.failed,
      duration: input.duration,
    };
    setCalls((prev) => {
      if (prev.some((call) => call.id === entry.id)) return prev;
      return [entry, ...prev].slice(0, 200);
    });
    return entry.id;
  };

  const markCallsAsSeen = useCallback(() => {
    setCallsLastSeenAt(new Date().toISOString());
  }, []);

  const missedCallsUnreadCount = useMemo(
    () => countUnreadMissedCalls(calls, callsLastSeenAt),
    [calls, callsLastSeenAt],
  );

  const updateCall = (
    callId: string,
    updates: Partial<Pick<GCall, "failed" | "missed" | "duration">>,
  ) => {
    setCalls((prev) =>
      prev.map((call) => (call.id === callId ? { ...call, ...updates } : call)),
    );
  };

  const startOutgoingCall = (input: {
    userId: string;
    conversationId: string;
    type: "audio" | "video";
  }) =>
    recordCall({
      userId: input.userId,
      conversationId: input.conversationId,
      type: input.type,
      direction: "outgoing",
      missed: false,
      failed: false,
      duration: null,
    });

  useEffect(() => {
    if (!isAuthenticated) {
      setStories([]);
      return;
    }
    const nextStories = (storiesQuery.data?.stories ?? []).filter(
      (story) => !blockedUserIds.includes(story.userId),
    );
    setStories(nextStories);
  }, [blockedUserIds, isAuthenticated, storiesQuery.data?.stories]);

  const isUserBlocked = (userId: string) => blockedUserIds.includes(userId);

  const blockUser = async (userId: string) => {
    await customFetch(`/api/users/${userId}/block`, { method: "POST" });
    setBlockedUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
    await queryClient.invalidateQueries({ queryKey: ["blocked-users"] });
    await queryClient.invalidateQueries({ queryKey: ["stories"] });

    const directChat = chats.find(
      (chat) =>
        chat.type === "direct" &&
        chat.participantIds.includes(userId) &&
        chat.participantIds.includes(currentUserId),
    );
    if (directChat) {
      await archiveConversation(directChat.id, true);
    }
  };

  const unblockUser = async (userId: string) => {
    await customFetch(`/api/users/${userId}/block`, { method: "DELETE" });
    setBlockedUserIds((prev) => prev.filter((id) => id !== userId));
    await queryClient.invalidateQueries({ queryKey: ["blocked-users"] });
    await queryClient.invalidateQueries({ queryKey: ["stories"] });
  };

  const archiveConversation = async (chatId: string, archived = true) => {
    const updatedConversation = await customFetch<ExtendedConversationSummary>(
      `/api/conversations/${chatId}/archive`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived }),
      },
    );
    queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
      conversations: upsertConversationSummary(
        current?.conversations ?? [],
        updatedConversation,
      ),
    }));
  };

  const muteConversation = async (chatId: string, muted = true) => {
    setLocalMutedConversationIds((prev) => {
      if (muted) {
        return prev.includes(chatId) ? prev : [...prev, chatId];
      }
      return prev.filter((id) => id !== chatId);
    });
    queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
      conversations: (current?.conversations ?? []).map((conversation) =>
        conversation.id === chatId ? { ...conversation, isMuted: muted } : conversation,
      ),
    }));

    try {
      const updatedConversation = await customFetch<ExtendedConversationSummary>(
        `/api/conversations/${chatId}/mute`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ muted }),
        },
      );
      queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
        conversations: upsertConversationSummary(
          current?.conversations ?? [],
          updatedConversation,
        ),
      }));
    } catch (error) {
      if (isHttpNotFound(error)) {
        return;
      }
      setLocalMutedConversationIds((prev) => {
        if (!muted) {
          return prev.includes(chatId) ? prev : [...prev, chatId];
        }
        return prev.filter((id) => id !== chatId);
      });
      queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
        conversations: (current?.conversations ?? []).map((conversation) =>
          conversation.id === chatId ? { ...conversation, isMuted: !muted } : conversation,
        ),
      }));
      throw error;
    }
  };

  const deleteConversation = async (chatId: string) => {
    await customFetch<{ success: boolean }>(`/api/conversations/${chatId}`, {
      method: "DELETE",
    });
    queryClient.setQueryData<ConversationsPage>(["conversations"], (current) => ({
      conversations: (current?.conversations ?? []).filter((conversation) => conversation.id !== chatId),
    }));
    queryClient.removeQueries({ queryKey: ["messages", chatId] });
  };

  const hasConversationData = conversationsQuery.data !== undefined;
  const isLoadingChats =
    isAuthenticated &&
    !hasConversationData &&
    (conversationsQuery.isPending ||
      (!localCacheHydrated && isNativeLocalDbEnabled()));

  return (
    <ChatsReactContext.Provider
      value={{
        chats,
        messages,
        users,
        calls,
        missedCallsUnreadCount,
        markCallsAsSeen,
        blockedUserIds,
        blockUser,
        unblockUser,
        isUserBlocked,
        archiveConversation,
        muteConversation,
        deleteConversation,
        stories,
        isLoadingChats,
        socketConnected,
        typingByConversation,
        sendMessage,
        reactToMessage,
        sendEmoji3dMessage,
        sendAudioMessage,
        sendImageMessage,
        sendVideoMessage,
        deleteMessage,
        consumeViewOnceMessage,
        reportViewOnceScreenshot,
        editMessage,
        setTypingState,
        markChatAsRead,
        addStoryView,
        replyToStory,
        createStory,
        deleteStory,
        loadConversationMessages,
        syncPhoneContacts,
        composeContactsSnapshot,
        getComposeContacts,
        updateSavedContactName,
        startConversationWithUser,
        startConversationWithUsers,
        updateGroup,
        addGroupMembers,
        removeGroupMember,
        leaveGroup,
        createGroupInviteLink,
        previewGroupInvite,
        joinGroupWithInvite,
        pendingGroupInvites,
        acceptGroupMemberInvite,
        declineGroupMemberInvite,
        groupInviteActionId,
        getOtherUser,
        isGroupAdmin,
        recordCall,
        updateCall,
        startOutgoingCall,
        joinConversationRealtime,
        leaveConversationRealtime,
      }}
    >
      <MessageSoundsBridge
        enabled={currentUser?.settings.notificationSoundEnabled ?? true}
        listPlayRef={playConversationListSoundRef}
        chatPlayRef={playChatIncomingSoundRef}
      />
      {children}
    </ChatsReactContext.Provider>
  );
}

import type { ContactMatch, GroupInvite, GroupInvitePreview } from "@workspace/api-client-react";
import type { GroupSettings } from "@/lib/group-settings";
import type { GroupMemberInvite } from "@/lib/group-member-invites";
import type { MessageReactionSummary } from "@/lib/message-reactions";
import type { MessageReplyRef } from "@/lib/message-reply";

export interface GUser {
  id: string;
  name: string;
  phone: string;
  avatar: string | null;
  bio: string;
  status: string;
  lastSeen: string | null;
  initials: string;
  color: string;
}

export type MessageStatus = "sending" | "failed" | "sent" | "delivered" | "read";
export type MessageType = "text" | "image" | "audio" | "video";
export type ChatType = "direct" | "group";

export interface GMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: MessageType;
  status: MessageStatus;
  timestamp: string;
  editedAt?: string | null;
  isDeleted?: boolean;
  replyTo?: MessageReplyRef;
  reactions?: MessageReactionSummary[];
}

export interface GChat {
  id: string;
  type: ChatType;
  participantIds: string[];
  name?: string;
  avatarUrl?: string | null;
  createdBy?: string;
  unreadCount: number;
  isArchived?: boolean;
  isMuted?: boolean;
  groupSettings?: GroupSettings;
  lastMessage?: GMessage;
}

export interface GStory {
  id: string;
  userId: string;
  type: "text" | "image" | "video";
  content: string;
  backgroundColor: string;
  expiresAt: string;
  viewerIds: string[];
  createdAt: string;
}

export interface GCall {
  id: string;
  userId: string;
  conversationId?: string;
  type: "audio" | "video";
  direction: "incoming" | "outgoing";
  missed: boolean;
  failed: boolean;
  timestamp: string;
  duration: string | null;
}

export interface ImportedPhoneContact {
  id: string;
  name: string;
  phone: string;
  normalizedPhone: string;
  isRegistered: boolean;
  matchedUser?: ContactMatch["user"];
}

export interface ComposeContactOption {
  id: string;
  userId: string | null;
  name: string;
  phone: string;
  avatar: string | null;
  initials: string;
  color: string;
  bio: string;
  status: string;
  lastSeen: string | null;
  isRegistered: boolean;
  contactSource?: "phonebook" | "story_reply" | "manual";
}

export interface StoryComposerDraft {
  type: "text" | "image" | "video";
  text: string;
  mediaUri: string | null;
  mimeType: string | null;
  mediaAssetId?: string | null;
  backgroundColor?: string;
  previewThumbnailUri?: string | null;
}

export interface TypingState {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface ChatsContextType {
  chats: GChat[];
  messages: Record<string, GMessage[]>;
  users: Record<string, GUser>;
  calls: GCall[];
  missedCallsUnreadCount: number;
  markCallsAsSeen: () => void;
  blockedUserIds: string[];
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  isUserBlocked: (userId: string) => boolean;
  archiveConversation: (chatId: string, archived?: boolean) => Promise<void>;
  muteConversation: (chatId: string, muted?: boolean) => Promise<void>;
  deleteConversation: (chatId: string) => Promise<void>;
  stories: GStory[];
  isLoadingChats: boolean;
  socketConnected: boolean;
  typingByConversation: Record<string, string[]>;
  sendMessage: (chatId: string, content: string, options?: { replyTo?: MessageReplyRef }) => void;
  reactToMessage: (chatId: string, messageId: string, emoji: string) => Promise<void>;
  sendEmoji3dMessage: (
    chatId: string,
    payload: import("@/lib/emoji-messages").Emoji3dMessagePayload,
  ) => void;
  sendAudioMessage: (chatId: string, payload: { url: string; key: string; durationSeconds: number; mimeType: string }) => void;
  sendImageMessage: (chatId: string, payload: { url: string; key: string; mimeType: string; width?: number; height?: number }) => void;
  sendVideoMessage: (chatId: string, payload: { url: string; key: string; mimeType: string; durationSeconds?: number; thumbnailKey?: string; thumbnailUrl?: string }) => void;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  editMessage: (chatId: string, messageId: string, content: string) => Promise<void>;
  setTypingState: (chatId: string, isTyping: boolean) => void;
  markChatAsRead: (chatId: string) => void;
  addStoryView: (storyId: string) => void;
  replyToStory: (storyId: string, input: { text?: string; emoji?: string }) => Promise<void>;
  createStory: (
    draft: StoryComposerDraft,
    onUploadStatus?: (status: import("@/lib/upload-status").UploadStatus | null) => void,
  ) => Promise<void>;
  deleteStory: (storyId: string) => Promise<void>;
  loadConversationMessages: (chatId: string) => Promise<void>;
  syncPhoneContacts: () => Promise<ImportedPhoneContact[]>;
  composeContactsSnapshot: ComposeContactOption[];
  getComposeContacts: (options?: { force?: boolean }) => Promise<ComposeContactOption[]>;
  updateSavedContactName: (phone: string, contactName: string) => Promise<void>;
  startConversationWithUser: (userId: string) => Promise<string>;
  startConversationWithUsers: (
    userIds: string[],
    title?: string | null,
    groupSettings?: GroupSettings,
  ) => Promise<string>;
  updateGroup: (
    conversationId: string,
    input: {
      title?: string | null;
      avatarUrl?: string | null;
      groupSettings?: Partial<GroupSettings>;
    },
  ) => Promise<void>;
  addGroupMembers: (conversationId: string, userIds: string[]) => Promise<void>;
  removeGroupMember: (conversationId: string, userId: string) => Promise<void>;
  leaveGroup: (conversationId: string) => Promise<void>;
  createGroupInviteLink: (conversationId: string) => Promise<GroupInvite>;
  previewGroupInvite: (inviteToken: string) => Promise<GroupInvitePreview>;
  joinGroupWithInvite: (inviteToken: string) => Promise<string>;
  pendingGroupInvites: GroupMemberInvite[];
  acceptGroupMemberInvite: (inviteId: string) => Promise<string>;
  declineGroupMemberInvite: (inviteId: string) => Promise<void>;
  groupInviteActionId: string | null;
  getOtherUser: (chat: GChat) => GUser | undefined;
  isGroupAdmin: (chat: GChat, userId: string) => boolean;
  recordCall: (
    input: Omit<GCall, "id" | "timestamp"> & { id?: string; timestamp?: string },
  ) => string;
  updateCall: (
    callId: string,
    updates: Partial<Pick<GCall, "failed" | "missed" | "duration">>,
  ) => void;
  startOutgoingCall: (input: {
    userId: string;
    conversationId: string;
    type: "audio" | "video";
  }) => string;
  joinConversationRealtime: (chatId: string) => void;
  leaveConversationRealtime: (chatId: string) => void;
}

export type { GroupInvite, GroupInvitePreview };

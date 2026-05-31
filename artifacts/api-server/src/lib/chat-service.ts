import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import {
  contactEdgesTable,
  conversationMembersTable,
  conversationsTable,
  db,
  deviceTokensTable,
  groupInvitesTable,
  hasDatabase,
  messageReceiptsTable,
  messagesTable,
  otpCodesTable,
  sessionsTable,
  storiesTable,
  storyViewsTable,
  usersTable,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, lte, ne, or } from "drizzle-orm";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from "libphonenumber-js";

import { logger } from "./logger";
import { sendOtpSms, shouldExposeOtpDemoCode } from "./sms-service";

type LastSeenVisibility = "everyone" | "contacts" | "nobody";
type ChatFontScale = "small" | "medium" | "large";
type ConversationType = "direct" | "group";
type MessageType = "text" | "image" | "audio" | "video";
type StoryType = "text" | "image" | "video";

export interface CountryOption {
  code: string;
  name: string;
  callingCode: string;
  flag: string;
}

export interface UserSettings {
  lastSeenVisibility: LastSeenVisibility;
  readReceiptsEnabled: boolean;
  notificationsEnabled: boolean;
  notificationSoundEnabled: boolean;
  vibrationEnabled: boolean;
  autoDownloadMedia: boolean;
  lowDataMode: boolean;
  chatFontScale: ChatFontScale;
}

export interface PresenceSnapshot {
  isOnline: boolean;
  lastSeenAt: string | null;
}

export interface UserProfile {
  id: string;
  phone: string;
  countryCode: string;
  name: string;
  avatarUrl: string | null;
  bio: string;
  statusText: string;
  initials: string;
  color: string;
  isOnboarded: boolean;
  settings: UserSettings;
  presence: PresenceSnapshot;
}

export interface ConversationParticipant {
  userId: string;
  profile: UserProfile;
}

export interface MessageReceipt {
  messageId: string;
  conversationId: string;
  userId: string;
  deliveredAt: string | null;
  readAt: string | null;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: MessageType;
  createdAt: string;
  receipts: MessageReceipt[];
}

export interface ConversationSummary {
  id: string;
  type: ConversationType;
  title: string | null;
  avatarUrl: string | null;
  createdBy: string;
  participants: ConversationParticipant[];
  unreadCount: number;
  lastMessage?: ConversationMessage;
  lastReadMessageId: string | null;
}

export interface StorySummary {
  id: string;
  userId: string;
  type: StoryType;
  content: string;
  backgroundColor: string;
  expiresAt: string;
  viewerIds: string[];
  createdAt: string;
}

export interface RealtimeEvent {
  type:
    | "message.created"
    | "message.deleted"
    | "message.updated"
    | "message.receipt"
    | "presence.updated"
    | "conversation.created"
    | "conversation.updated"
    | "member.added"
    | "member.removed"
    | "call.invited";
  participantIds: string[];
  conversationId?: string;
  messageId?: string;
  message?: ConversationMessage;
  receipt?: MessageReceipt;
  presence?: { userId: string; snapshot: PresenceSnapshot };
  conversation?: ConversationSummary;
  removedUserId?: string;
  callerUserId?: string;
  callerName?: string;
  callType?: "audio" | "video";
}

export interface GroupInvite {
  token: string;
  inviteUrl: string;
  expiresAt: string;
}

export interface GroupInvitePreview {
  token: string;
  conversationId: string;
  title: string | null;
  avatarUrl: string | null;
  memberCount: number;
  expiresAt: string;
}

type Awaitable<T> = T | Promise<T>;

export interface ChatService {
  setEventPublisher(publisher: ((event: RealtimeEvent) => void) | null): void;
  listSupportedCountries(): Awaitable<{ countries: CountryOption[] }>;
  requestOtp(input: {
    phone: string;
    countryCode: string;
    forceDemoCode?: boolean;
  }): Awaitable<{
    requestId: string;
    expiresAt: string;
    demoCode: string | null;
  }>;
  verifyOtp(input: { requestId: string; phone: string; code: string }): Awaitable<{
    token: string;
    user: UserProfile;
  }>;
  getCurrentUser(token: string): Awaitable<UserProfile>;
  updateCurrentUser(
    token: string,
    updates: Partial<Pick<UserProfile, "name" | "avatarUrl" | "bio" | "statusText">> &
      Partial<UserSettings>,
  ): Awaitable<UserProfile>;
  updatePresenceHeartbeat(token: string, isOnline: boolean): Awaitable<PresenceSnapshot>;
  listConversations(token: string): Awaitable<{ conversations: ConversationSummary[] }>;
  createConversation(
    token: string,
    input: {
      participantUserIds: string[];
      participantPhones: string[];
      title: string | null;
    },
  ): Awaitable<ConversationSummary>;
  getConversation(token: string, conversationId: string): Awaitable<ConversationSummary>;
  updateConversation(
    token: string,
    conversationId: string,
    input: { title?: string | null; avatarUrl?: string | null },
  ): Awaitable<ConversationSummary>;
  addConversationMembers(
    token: string,
    conversationId: string,
    input: { participantUserIds: string[]; participantPhones: string[] },
  ): Awaitable<ConversationSummary>;
  removeConversationMember(
    token: string,
    conversationId: string,
    targetUserId: string,
  ): Awaitable<ConversationSummary>;
  leaveConversation(token: string, conversationId: string): Awaitable<{ conversationId: string }>;
  createGroupInvite(token: string, conversationId: string): Awaitable<GroupInvite>;
  getGroupInvitePreview(token: string, inviteToken: string): Awaitable<GroupInvitePreview>;
  joinGroupByInvite(token: string, inviteToken: string): Awaitable<ConversationSummary>;
  listConversationMessages(
    token: string,
    conversationId: string,
    params: { cursor?: string; limit?: number },
  ): Awaitable<{ messages: ConversationMessage[]; nextCursor: string | null }>;
  sendConversationMessage(
    token: string,
    conversationId: string,
    input: { content: string; type: MessageType },
    authenticatedUserId?: string,
  ): Awaitable<ConversationMessage>;
  deleteConversationMessage(token: string, messageId: string): Awaitable<{
    messageId: string;
    conversationId: string;
  }>;
  updateConversationMessage(
    token: string,
    messageId: string,
    input: { content: string },
  ): Awaitable<ConversationMessage>;
  markConversationRead(
    token: string,
    conversationId: string,
    input: { messageId: string },
  ): Awaitable<MessageReceipt>;
  markMessageDelivered(token: string, messageId: string): Awaitable<MessageReceipt>;
  syncContacts(
    token: string,
    input: { contacts: Array<{ name: string; phone: string }> },
  ): Awaitable<{
    matches: Array<{ contactName: string; phone: string; user: UserProfile }>;
  }>;
  registerDeviceToken(
    token: string,
    input: { pushToken: string; platform: string; deviceName: string },
  ): Awaitable<{ id: string; pushToken: string; platform: string; deviceName: string }>;
  listStories(token: string): Awaitable<{ stories: StorySummary[] }>;
  createStory(
    token: string,
    input: { type: StoryType; content: string; backgroundColor?: string },
  ): Awaitable<StorySummary>;
  addStoryView(token: string, storyId: string): Awaitable<StorySummary>;
  replyToStory(
    token: string,
    storyId: string,
    input: { text?: string; emoji?: string },
  ): Awaitable<ConversationMessage>;
  deleteStory(token: string, storyId: string): Awaitable<{ storyId: string }>;
  resolveUserIdByToken(token: string): Awaitable<string>;
  notifyIncomingCall(
    token: string,
    input: {
      conversationId: string;
      type: "audio" | "video";
      callerUserId: string;
      callerName: string;
    },
  ): Awaitable<void>;
}

interface UserRecord {
  id: string;
  phone: string;
  normalizedPhone: string;
  countryCode: string;
  name: string;
  avatarUrl: string | null;
  bio: string;
  statusText: string;
  color: string;
  isOnboarded: boolean;
  settings: UserSettings;
  isOnline: boolean;
  lastSeenAt: string | null;
}

interface SessionRecord {
  id: string;
  tokenHash: string;
  userId: string;
  rawTokenPreview?: string;
  expiresAt: string;
  lastSeenAt: string | null;
}

interface OtpRequestRecord {
  id: string;
  phone: string;
  normalizedPhone: string;
  countryCode: string;
  codeHash: string;
  attempts: number;
  expiresAt: string;
  consumedAt: string | null;
}

interface ConversationRecord {
  id: string;
  type: ConversationType;
  title: string | null;
  avatarUrl: string | null;
  participantIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ConversationMemberRecord {
  conversationId: string;
  userId: string;
  unreadCount: number;
  lastReadMessageId: string | null;
}

interface MessageRecord {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: MessageType;
  createdAt: string;
}

interface ContactRecord {
  ownerUserId: string;
  normalizedPhone: string;
  contactName: string;
  matchedUserId: string | null;
}

interface DeviceRecord {
  id: string;
  userId: string;
  pushToken: string;
  platform: string;
  deviceName: string;
}

const USER_COLORS = [
  "#6D4AFF",
  "#00D4A4",
  "#FF6B6B",
  "#FFB347",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#DDA0DD",
];
const OTP_TTL_MS = 5 * 60_000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_SYNC_CONTACTS = 1000;
const MAX_MESSAGE_LENGTH = 4000;
const MESSAGE_DELETE_WINDOW_MS = 15 * 60_000;
const MAX_DEVICE_NAME_LENGTH = 100;
const MAX_GROUP_MEMBERS = 100;
const GROUP_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function buildGroupInviteUrl(token: string) {
  return `gbairai://group/join?token=${encodeURIComponent(token)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function randomId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

function randomOtpCode() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function secureStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function flagFromCountryCode(code: string) {
  return code
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

function displayCountryName(code: string) {
  const display = new Intl.DisplayNames(["fr"], { type: "region" });
  return display.of(code.toUpperCase()) ?? code.toUpperCase();
}

function initialsFromName(name: string) {
  const chunks = name.trim().split(/\s+/).filter(Boolean);
  return chunks
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "GB";
}

function pickUserColor(seed: string) {
  const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return USER_COLORS[total % USER_COLORS.length] ?? "#6D4AFF";
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function normalizePhone(phone: string, countryCode?: string) {
  const trimmedPhone = phone.trim();
  const parsed =
    parsePhoneNumberFromString(trimmedPhone, countryCode?.toUpperCase() as never) ??
    parsePhoneNumberFromString(trimmedPhone);

  if (parsed) {
    return {
      e164: parsed.number,
      countryCode: parsed.country ?? countryCode?.toUpperCase() ?? "GN",
    };
  }

  const digits = trimmedPhone.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) {
    throw new Error("Numéro de téléphone invalide");
  }

  return {
    e164: digits,
    countryCode: countryCode?.toUpperCase() ?? "GN",
  };
}

async function sendExpoPushMessages(
  devices: DeviceRecord[],
  senderName: string,
  message: string,
) {
  const validTokens = devices
    .map((device) => device.pushToken)
    .filter((token) => token.startsWith("ExponentPushToken["));

  if (!validTokens.length) return;

  const payload = validTokens.map((to) => ({
    to,
    title: senderName,
    body: message,
    sound: "default",
  }));

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Notifications are best-effort in development.
  }
}

async function sendExpoIncomingCallPushes(
  recipients: Array<{ pushToken: string; notificationSoundEnabled: boolean }>,
  input: {
    callerName: string;
    conversationId: string;
    callType: "audio" | "video";
    callerUserId: string;
  },
) {
  const payload = recipients
    .filter((item) => item.pushToken.startsWith("ExponentPushToken["))
    .map((item) => ({
      to: item.pushToken,
      title: input.callerName,
      body: input.callType === "video" ? "Appel vidéo entrant" : "Appel audio entrant",
      sound: item.notificationSoundEnabled ? "default" : null,
      priority: "high",
      channelId: "calls",
      categoryId: "incoming_call",
      data: {
        type: "incoming_call",
        conversationId: input.conversationId,
        callType: input.callType,
        callerUserId: input.callerUserId,
        callerName: input.callerName,
      },
    }));

  if (!payload.length) return;

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Notifications are best-effort in development.
  }
}

class InMemoryChatService {
  private readonly users = new Map<string, UserRecord>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly otpRequests = new Map<string, OtpRequestRecord>();
  private readonly conversations = new Map<string, ConversationRecord>();
  private readonly conversationMembers = new Map<string, ConversationMemberRecord>();
  private readonly messages = new Map<string, MessageRecord>();
  private readonly messageReceipts = new Map<string, MessageReceipt>();
  private readonly contacts = new Map<string, ContactRecord>();
  private readonly devices = new Map<string, DeviceRecord>();
  private eventPublisher: ((event: RealtimeEvent) => void) | null = null;

  constructor() {
    this.seed();
  }

  setEventPublisher(publisher: ((event: RealtimeEvent) => void) | null) {
    this.eventPublisher = publisher;
  }

  listSupportedCountries() {
    return {
      countries: getCountries()
        .map((code) => ({
          code,
          name: displayCountryName(code),
          callingCode: `+${getCountryCallingCode(code)}`,
          flag: flagFromCountryCode(code),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    };
  }

  requestOtp(input: { phone: string; countryCode: string; forceDemoCode?: boolean }) {
    const normalized = normalizePhone(input.phone, input.countryCode);
    this.cleanupExpiredOtpRequests();

    const requestId = randomId("otp");
    const rawCode = randomOtpCode();
    const record: OtpRequestRecord = {
      id: requestId,
      phone: normalized.e164,
      normalizedPhone: normalized.e164,
      countryCode: normalized.countryCode,
      codeHash: sha256(rawCode),
      attempts: 0,
      expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      consumedAt: null,
    };

    this.otpRequests.set(requestId, record);

    void sendOtpSms({
      phoneE164: normalized.e164,
      code: rawCode,
      countryCode: normalized.countryCode,
    }).catch((error: unknown) => {
      if (process.env["NODE_ENV"] === "production") {
        logger.error({ err: error }, "Failed to send OTP SMS");
        return;
      }
      logger.warn({ err: error }, "OTP SMS failed in development");
    });

    const exposeDemoCode = shouldExposeOtpDemoCode() || input.forceDemoCode;
    if (exposeDemoCode) {
      logger.info(
        { phone: normalized.e164, requestId, otpDemoCode: rawCode },
        "OTP demo code generated",
      );
    }

    return {
      requestId,
      expiresAt: record.expiresAt,
      demoCode: exposeDemoCode ? rawCode : null,
    };
  }

  verifyOtp(input: { requestId: string; phone: string; code: string }) {
    const request = this.otpRequests.get(input.requestId);
    if (!request) {
      throw new Error("Demande OTP introuvable");
    }

    const normalized = normalizePhone(input.phone, request.countryCode);
    if (normalized.e164 !== request.normalizedPhone) {
      throw new Error("Le numéro ne correspond pas à la demande OTP");
    }

    if (request.consumedAt) {
      throw new Error("Ce code a déjà été utilisé");
    }

    if (new Date(request.expiresAt).getTime() < Date.now()) {
      throw new Error("Le code OTP a expiré");
    }

    if (request.attempts >= MAX_OTP_ATTEMPTS) {
      throw new Error("Trop de tentatives OTP, veuillez recommencer");
    }

    const providedCodeHash = sha256(input.code.trim());
    if (!secureStringEqual(request.codeHash, providedCodeHash)) {
      request.attempts += 1;
      this.otpRequests.set(request.id, request);
      throw new Error("Code OTP invalide");
    }

    request.consumedAt = nowIso();
    this.otpRequests.set(request.id, request);

    let user = this.findUserByNormalizedPhone(normalized.e164);
    if (!user) {
      user = {
        id: randomId("user"),
        phone: normalized.e164,
        normalizedPhone: normalized.e164,
        countryCode: normalized.countryCode,
        name: "",
        avatarUrl: null,
        bio: "",
        statusText: "Disponible",
        color: USER_COLORS[this.users.size % USER_COLORS.length] ?? "#6D4AFF",
        isOnboarded: false,
        settings: this.defaultSettings(),
        isOnline: true,
        lastSeenAt: null,
      };
      this.users.set(user.id, user);
    } else {
      user.isOnline = true;
      user.lastSeenAt = null;
      this.users.set(user.id, user);
    }

    const session: SessionRecord = {
      id: randomId("session"),
      tokenHash: sha256(randomId("token")),
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      lastSeenAt: nowIso(),
    };
    const rawToken = randomId("token");
    session.tokenHash = sha256(rawToken);
    this.sessions.set(session.tokenHash, session);

    return {
      token: rawToken,
      user: this.toUserProfile(user.id, user.id),
    };
  }

  getCurrentUser(token: string) {
    const user = this.requireUserByToken(token);
    return this.toUserProfile(user.id, user.id);
  }

  updateCurrentUser(
    token: string,
    updates: Partial<
      Pick<
        UserProfile,
        "name" | "avatarUrl" | "bio" | "statusText"
      >
    > & Partial<UserSettings>,
  ) {
    const user = this.requireUserByToken(token);
    user.name = updates.name ?? user.name;
    user.avatarUrl =
      updates.avatarUrl === undefined ? user.avatarUrl : updates.avatarUrl;
    user.bio = updates.bio ?? user.bio;
    user.statusText = updates.statusText ?? user.statusText;
    user.settings = {
      ...user.settings,
      lastSeenVisibility:
        updates.lastSeenVisibility ?? user.settings.lastSeenVisibility,
      readReceiptsEnabled:
        updates.readReceiptsEnabled ?? user.settings.readReceiptsEnabled,
      notificationsEnabled:
        updates.notificationsEnabled ?? user.settings.notificationsEnabled,
      notificationSoundEnabled:
        updates.notificationSoundEnabled ??
        user.settings.notificationSoundEnabled,
      vibrationEnabled:
        updates.vibrationEnabled ?? user.settings.vibrationEnabled,
      autoDownloadMedia:
        updates.autoDownloadMedia ?? user.settings.autoDownloadMedia,
      lowDataMode: updates.lowDataMode ?? user.settings.lowDataMode,
      chatFontScale: updates.chatFontScale ?? user.settings.chatFontScale,
    };
    user.isOnboarded = Boolean(user.name.trim());
    this.users.set(user.id, user);
    return this.toUserProfile(user.id, user.id);
  }

  updatePresenceHeartbeat(token: string, isOnline: boolean) {
    const user = this.requireUserByToken(token);
    user.isOnline = isOnline;
    user.lastSeenAt = isOnline ? null : nowIso();
    this.users.set(user.id, user);

    const snapshot = this.toPresenceSnapshot(user.id, user.id);
    this.publish({
      type: "presence.updated",
      participantIds: Array.from(this.users.keys()),
      presence: { userId: user.id, snapshot },
    });

    return snapshot;
  }

  listConversations(token: string) {
    const user = this.requireUserByToken(token);
    const conversations = this.getMemberConversations(user.id)
      .map((conversation) => this.toConversationSummary(conversation.id, user.id))
      .sort((a, b) => {
        const aDate = a.lastMessage?.createdAt ?? "";
        const bDate = b.lastMessage?.createdAt ?? "";
        return bDate.localeCompare(aDate);
      });

    return { conversations };
  }

  createConversation(
    token: string,
    input: {
      participantUserIds: string[];
      participantPhones: string[];
      title: string | null;
    },
  ) {
    const currentUser = this.requireUserByToken(token);
    const participantIds = new Set<string>([currentUser.id]);

    for (const userId of input.participantUserIds) {
      if (this.users.has(userId)) participantIds.add(userId);
    }

    for (const phone of input.participantPhones) {
      const normalized = normalizePhone(phone);
      const user = this.findUserByNormalizedPhone(normalized.e164);
      if (user) participantIds.add(user.id);
    }

    const ids = Array.from(participantIds);
    if (ids.length < 2) {
      throw new Error("Au moins deux participants sont nécessaires");
    }
    if (ids.length > MAX_GROUP_MEMBERS) {
      throw new Error("Le groupe dépasse la limite de participants autorisés");
    }

    const normalizedTitle = input.title?.trim() || null;
    const type: ConversationType = ids.length === 2 && !normalizedTitle ? "direct" : "group";

    const existing = Array.from(this.conversations.values()).find((conversation) => {
      if (conversation.type !== type) return false;
      if (type !== "direct") return false;
      return (
        conversation.participantIds.length === ids.length &&
        conversation.participantIds.every((value) => ids.includes(value))
      );
    });

    if (existing) {
      return this.toConversationSummary(existing.id, currentUser.id);
    }

    const conversation: ConversationRecord = {
      id: randomId("conv"),
      type,
      title: normalizedTitle,
      avatarUrl: null,
      participantIds: ids,
      createdBy: currentUser.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.conversations.set(conversation.id, conversation);

    for (const userId of ids) {
      this.conversationMembers.set(
        this.memberKey(conversation.id, userId),
        {
          conversationId: conversation.id,
          userId,
          unreadCount: 0,
          lastReadMessageId: null,
        },
      );
    }

    const summary = this.toConversationSummary(conversation.id, currentUser.id);
    this.publish({
      type: "conversation.created",
      participantIds: ids,
      conversation: summary,
    });

    return summary;
  }

  getConversation(token: string, conversationId: string) {
    const user = this.requireUserByToken(token);
    this.requireConversationMembership(conversationId, user.id);
    return this.toConversationSummary(conversationId, user.id);
  }

  listConversationMessages(
    token: string,
    conversationId: string,
    params: { cursor?: string; limit?: number },
  ) {
    const user = this.requireUserByToken(token);
    this.requireConversationMembership(conversationId, user.id);
    const all = this.getConversationMessages(conversationId).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );

    let startIndex = 0;
    if (params.cursor) {
      const foundIndex = all.findIndex((message) => message.id === params.cursor);
      startIndex = foundIndex >= 0 ? foundIndex + 1 : 0;
    }

    const limit = params.limit ?? 50;
    const page = all.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < all.length ? page.at(-1)?.id ?? null : null;

    return {
      messages: page
        .slice()
        .reverse()
        .map((message) => this.toMessage(conversationId, message.id)),
      nextCursor,
    };
  }

  sendConversationMessage(
    token: string,
    conversationId: string,
    input: { content: string; type: MessageType },
  ) {
    const sender = this.requireUserByToken(token);
    const conversation = this.requireConversationMembership(conversationId, sender.id);
    const normalizedContent = input.content.trim();
    const message: MessageRecord = {
      id: randomId("msg"),
      conversationId,
      senderId: sender.id,
      content: normalizedContent,
      type: input.type,
      createdAt: nowIso(),
    };

    if (!message.content) {
      throw new Error("Le message ne peut pas être vide");
    }
    if (message.content.length > MAX_MESSAGE_LENGTH) {
      throw new Error("Le message est trop long");
    }

    this.messages.set(message.id, message);
    conversation.updatedAt = message.createdAt;
    this.conversations.set(conversation.id, conversation);

    for (const participantId of conversation.participantIds) {
      const receipt: MessageReceipt = {
        messageId: message.id,
        conversationId,
        userId: participantId,
        deliveredAt: participantId === sender.id ? message.createdAt : null,
        readAt: participantId === sender.id ? message.createdAt : null,
      };
      this.messageReceipts.set(this.receiptKey(message.id, participantId), receipt);

      const membership = this.requireMembershipRecord(conversationId, participantId);
      if (participantId === sender.id) {
        membership.lastReadMessageId = message.id;
      } else {
        membership.unreadCount += 1;
      }
      this.conversationMembers.set(this.memberKey(conversationId, participantId), membership);
    }

    const fullMessage = this.toMessage(conversationId, message.id);
    const offlineRecipients = conversation.participantIds
      .map((participantId) => this.users.get(participantId))
      .filter((participant): participant is UserRecord => Boolean(participant))
      .filter(
        (participant) =>
          participant.id !== sender.id &&
          !participant.isOnline &&
          participant.settings.notificationsEnabled,
      )
      .flatMap((participant) =>
        Array.from(this.devices.values()).filter(
          (device) => device.userId === participant.id,
        ),
      );

    void sendExpoPushMessages(offlineRecipients, sender.name || "Gbairai", input.content);

    this.publish({
      type: "message.created",
      participantIds: conversation.participantIds,
      conversationId,
      message: fullMessage,
    });

    return fullMessage;
  }

  markConversationRead(
    token: string,
    conversationId: string,
    input: { messageId: string },
  ) {
    const user = this.requireUserByToken(token);
    const conversation = this.requireConversationMembership(conversationId, user.id);
    const targetMessage = this.messages.get(input.messageId);
    if (!targetMessage || targetMessage.conversationId !== conversationId) {
      throw new Error("Message introuvable");
    }

    const targetTime = targetMessage.createdAt;
    let latestReceipt: MessageReceipt | null = null;
    for (const message of this.getConversationMessages(conversationId)) {
      if (message.senderId === user.id) continue;
      if (message.createdAt > targetTime) continue;
      const key = this.receiptKey(message.id, user.id);
      const current = this.messageReceipts.get(key);
      const nextReceipt: MessageReceipt = {
        messageId: message.id,
        conversationId,
        userId: user.id,
        deliveredAt: current?.deliveredAt ?? nowIso(),
        readAt: current?.readAt ?? nowIso(),
      };
      this.messageReceipts.set(key, nextReceipt);
      latestReceipt = nextReceipt;
    }

    const membership = this.requireMembershipRecord(conversationId, user.id);
    membership.unreadCount = 0;
    membership.lastReadMessageId = input.messageId;
    this.conversationMembers.set(this.memberKey(conversationId, user.id), membership);

    const receipt =
      latestReceipt ??
      ({
        messageId: input.messageId,
        conversationId,
        userId: user.id,
        deliveredAt: nowIso(),
        readAt: nowIso(),
      } satisfies MessageReceipt);

    this.publish({
      type: "message.receipt",
      participantIds: conversation.participantIds,
      conversationId,
      receipt,
    });

    return receipt;
  }

  markMessageDelivered(token: string, messageId: string) {
    const user = this.requireUserByToken(token);
    const message = this.messages.get(messageId);
    if (!message) {
      throw new Error("Message introuvable");
    }
    this.requireConversationMembership(message.conversationId, user.id);

    const key = this.receiptKey(messageId, user.id);
    const current = this.messageReceipts.get(key);
    const receipt: MessageReceipt = {
      messageId,
      conversationId: message.conversationId,
      userId: user.id,
      deliveredAt: current?.deliveredAt ?? nowIso(),
      readAt: current?.readAt ?? null,
    };
    this.messageReceipts.set(key, receipt);

    const conversation = this.conversations.get(message.conversationId);
    if (conversation) {
      this.publish({
        type: "message.receipt",
        participantIds: conversation.participantIds,
        conversationId: message.conversationId,
        receipt,
      });
    }

    return receipt;
  }

  syncContacts(token: string, input: { contacts: Array<{ name: string; phone: string }> }) {
    const user = this.requireUserByToken(token);
    if (input.contacts.length > MAX_SYNC_CONTACTS) {
      throw new Error("Trop de contacts à synchroniser en une seule requête");
    }
    const matches = input.contacts
      .map((contact) => {
        try {
          const normalized = normalizePhone(contact.phone);
          const matched = this.findUserByNormalizedPhone(normalized.e164);
          this.contacts.set(this.contactKey(user.id, normalized.e164), {
            ownerUserId: user.id,
            normalizedPhone: normalized.e164,
            contactName: contact.name,
            matchedUserId: matched?.id ?? null,
          });

          if (!matched || matched.id === user.id) return null;
          return {
            contactName: contact.name,
            phone: normalized.e164,
            user: this.toUserProfile(matched.id, user.id),
          };
        } catch {
          return null;
        }
      })
      .filter((match): match is NonNullable<typeof match> => Boolean(match));

    return { matches };
  }

  registerDeviceToken(
    token: string,
    input: { pushToken: string; platform: string; deviceName: string },
  ) {
    const user = this.requireUserByToken(token);
    if (input.deviceName.trim().length === 0) {
      throw new Error("Le nom de l'appareil est requis");
    }
    if (input.deviceName.length > MAX_DEVICE_NAME_LENGTH) {
      throw new Error("Le nom de l'appareil est trop long");
    }
    const existing = Array.from(this.devices.values()).find(
      (device) =>
        device.userId === user.id && device.pushToken === input.pushToken,
    );
    const device: DeviceRecord = {
      id: existing?.id ?? randomId("device"),
      userId: user.id,
      pushToken: input.pushToken,
      platform: input.platform,
      deviceName: input.deviceName,
    };
    this.devices.set(device.id, device);
    return {
      id: device.id,
      pushToken: device.pushToken,
      platform: device.platform,
      deviceName: device.deviceName,
    };
  }

  resolveUserIdByToken(token: string) {
    return this.requireUserByToken(token).id;
  }

  private publish(event: RealtimeEvent) {
    this.eventPublisher?.(event);
  }

  private getMemberConversations(userId: string) {
    return Array.from(this.conversations.values()).filter((conversation) =>
      conversation.participantIds.includes(userId),
    );
  }

  private getConversationMessages(conversationId: string) {
    return Array.from(this.messages.values()).filter(
      (message) => message.conversationId === conversationId,
    );
  }

  private defaultSettings(): UserSettings {
    return {
      lastSeenVisibility: "everyone",
      readReceiptsEnabled: true,
      notificationsEnabled: true,
      notificationSoundEnabled: true,
      vibrationEnabled: true,
      autoDownloadMedia: true,
      lowDataMode: false,
      chatFontScale: "medium",
    };
  }

  private requireSession(token: string) {
    const tokenHash = sha256(token.trim());
    const session = this.sessions.get(tokenHash);
    if (!session) {
      throw new Error("Session invalide");
    }

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.sessions.delete(tokenHash);
      throw new Error("Session expirée");
    }

    session.lastSeenAt = nowIso();
    this.sessions.set(tokenHash, session);
    return session;
  }

  private cleanupExpiredOtpRequests() {
    const now = Date.now();
    for (const [id, request] of this.otpRequests.entries()) {
      if (
        request.consumedAt ||
        new Date(request.expiresAt).getTime() < now ||
        request.attempts >= MAX_OTP_ATTEMPTS
      ) {
        this.otpRequests.delete(id);
      }
    }
  }

  private requireUserByToken(token: string) {
    const session = this.requireSession(token);
    const user = this.users.get(session.userId);
    if (!user) throw new Error("Utilisateur introuvable");
    return user;
  }

  private requireMembershipRecord(conversationId: string, userId: string) {
    const membership = this.conversationMembers.get(this.memberKey(conversationId, userId));
    if (!membership) {
      throw new Error("Conversation introuvable");
    }
    return membership;
  }

  private requireConversationMembership(conversationId: string, userId: string) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || !conversation.participantIds.includes(userId)) {
      throw new Error("Conversation introuvable");
    }
    return conversation;
  }

  private findUserByNormalizedPhone(phone: string) {
    return Array.from(this.users.values()).find((user) => user.normalizedPhone === phone);
  }

  private toPresenceSnapshot(subjectUserId: string, viewerUserId: string): PresenceSnapshot {
    const user = this.users.get(subjectUserId);
    if (!user) throw new Error("Utilisateur introuvable");

    if (subjectUserId === viewerUserId) {
      return {
        isOnline: user.isOnline,
        lastSeenAt: user.lastSeenAt,
      };
    }

    if (user.settings.lastSeenVisibility === "nobody") {
      return { isOnline: false, lastSeenAt: null };
    }

    if (user.settings.lastSeenVisibility === "contacts") {
      const contact = this.contacts.get(this.contactKey(viewerUserId, user.normalizedPhone));
      if (!contact) {
        return { isOnline: false, lastSeenAt: null };
      }
    }

    return {
      isOnline: user.isOnline,
      lastSeenAt: user.lastSeenAt,
    };
  }

  private toUserProfile(subjectUserId: string, viewerUserId: string): UserProfile {
    const user = this.users.get(subjectUserId);
    if (!user) throw new Error("Utilisateur introuvable");

    return {
      id: user.id,
      phone: user.phone,
      countryCode: user.countryCode,
      name: user.name || user.phone,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      statusText: user.statusText,
      initials: initialsFromName(user.name || user.phone),
      color: user.color,
      isOnboarded: user.isOnboarded,
      settings: { ...user.settings },
      presence: this.toPresenceSnapshot(user.id, viewerUserId),
    };
  }

  private toMessage(conversationId: string, messageId: string): ConversationMessage {
    const message = this.messages.get(messageId);
    if (!message || message.conversationId !== conversationId) {
      throw new Error("Message introuvable");
    }

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      type: message.type,
      createdAt: message.createdAt,
      receipts: Array.from(this.messageReceipts.values()).filter(
        (receipt) => receipt.messageId === message.id,
      ),
    };
  }

  private toConversationSummary(conversationId: string, viewerUserId: string): ConversationSummary {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error("Conversation introuvable");
    }
    const membership = this.requireMembershipRecord(conversationId, viewerUserId);
    const lastMessageRecord = this.getConversationMessages(conversationId).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )[0];

    return {
      id: conversation.id,
      type: conversation.type,
      title: conversation.title,
      avatarUrl: conversation.avatarUrl ?? null,
      createdBy: conversation.createdBy,
      participants: conversation.participantIds.map((participantId) => ({
        userId: participantId,
        profile: this.toUserProfile(participantId, viewerUserId),
      })),
      unreadCount: membership.unreadCount,
      lastMessage: lastMessageRecord
        ? this.toMessage(conversationId, lastMessageRecord.id)
        : undefined,
      lastReadMessageId: membership.lastReadMessageId,
    };
  }

  private memberKey(conversationId: string, userId: string) {
    return `${conversationId}:${userId}`;
  }

  private receiptKey(messageId: string, userId: string) {
    return `${messageId}:${userId}`;
  }

  private contactKey(ownerUserId: string, normalizedPhone: string) {
    return `${ownerUserId}:${normalizedPhone}`;
  }

  private seed() {
    const seedUsers: Array<Pick<UserRecord, "phone" | "countryCode" | "name" | "bio" | "statusText"> & { lastSeenAt: string | null }> = [
      {
        phone: "+224622134567",
        countryCode: "GN",
        name: "Aminata Diallo",
        bio: "La vie est belle",
        statusText: "En ligne",
        lastSeenAt: null,
      },
      {
        phone: "+224625987321",
        countryCode: "GN",
        name: "Ibrahim Kouyaté",
        bio: "Dev passionné",
        statusText: "Bonjour!",
        lastSeenAt: hoursAgo(0.4),
      },
      {
        phone: "+2250745000000",
        countryCode: "CI",
        name: "Awa Koné",
        bio: "Entrepreneure",
        statusText: "Disponible",
        lastSeenAt: hoursAgo(2),
      },
      {
        phone: "+221771112233",
        countryCode: "SN",
        name: "Mamadou Sow",
        bio: "Toujours motivé",
        statusText: "Au travail",
        lastSeenAt: null,
      },
      {
        phone: "+22997001122",
        countryCode: "BJ",
        name: "Clarisse Dossou",
        bio: "Créative",
        statusText: "Ne pas déranger",
        lastSeenAt: hoursAgo(6),
      },
      {
        phone: "+22670112233",
        countryCode: "BF",
        name: "Issa Traoré",
        bio: "Toujours connecté",
        statusText: "En ligne",
        lastSeenAt: null,
      },
    ];

    for (const [index, seedUser] of seedUsers.entries()) {
      const normalized = normalizePhone(seedUser.phone, seedUser.countryCode);
      const user: UserRecord = {
        id: `seed_user_${index + 1}`,
        phone: normalized.e164,
        normalizedPhone: normalized.e164,
        countryCode: normalized.countryCode,
        name: seedUser.name,
        avatarUrl: null,
        bio: seedUser.bio,
        statusText: seedUser.statusText,
        color: USER_COLORS[index % USER_COLORS.length] ?? "#6D4AFF",
        isOnboarded: true,
        settings: this.defaultSettings(),
        isOnline: seedUser.lastSeenAt === null,
        lastSeenAt: seedUser.lastSeenAt,
      };
      this.users.set(user.id, user);
    }

    const me: UserRecord = {
      id: "seed_me",
      phone: "+224620000000",
      normalizedPhone: "+224620000000",
      countryCode: "GN",
      name: "Moi Gbairai",
      avatarUrl: null,
      bio: "Bienvenue sur Gbairai",
      statusText: "Disponible",
      color: "#6D4AFF",
      isOnboarded: true,
      settings: this.defaultSettings(),
      isOnline: true,
      lastSeenAt: null,
    };
    this.users.set(me.id, me);

    const session: SessionRecord = {
      id: "seed_session",
      tokenHash: sha256("seed-demo-token"),
      userId: me.id,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60_000).toISOString(),
      lastSeenAt: nowIso(),
    };
    this.sessions.set(session.tokenHash, session);

    const directPairs = [
      ["seed_me", "seed_user_1", "Bonjour Aminata !", "Salut, tout va bien ?"],
      ["seed_me", "seed_user_2", "Tu arrives bientôt ?", "Oui, je suis en route."],
      ["seed_me", "seed_user_3", "On valide la réunion ?", "Oui, demain matin."],
      ["seed_me", "seed_user_4", "Le dossier est prêt.", "Parfait, merci."],
    ] as const;

    for (const [index, [left, right, firstContent, secondContent]] of directPairs.entries()) {
      const conversationId = `seed_conv_${index + 1}`;
      const conversation: ConversationRecord = {
        id: conversationId,
        type: "direct",
        title: null,
        avatarUrl: null,
        participantIds: [left, right],
        createdBy: left,
        createdAt: hoursAgo(24 - index),
        updatedAt: hoursAgo(2 - index * 0.1),
      };
      this.conversations.set(conversation.id, conversation);
      for (const participantId of conversation.participantIds) {
        this.conversationMembers.set(this.memberKey(conversation.id, participantId), {
          conversationId: conversation.id,
          userId: participantId,
          unreadCount: participantId === left ? 1 : 0,
          lastReadMessageId: null,
        });
      }

      const firstMessage: MessageRecord = {
        id: `${conversationId}_1`,
        conversationId,
        senderId: right,
        content: firstContent,
        type: "text",
        createdAt: hoursAgo(1.2 + index),
      };
      const secondMessage: MessageRecord = {
        id: `${conversationId}_2`,
        conversationId,
        senderId: left,
        content: secondContent,
        type: "text",
        createdAt: hoursAgo(0.8 + index),
      };
      this.messages.set(firstMessage.id, firstMessage);
      this.messages.set(secondMessage.id, secondMessage);

      for (const message of [firstMessage, secondMessage]) {
        for (const participantId of conversation.participantIds) {
          this.messageReceipts.set(this.receiptKey(message.id, participantId), {
            messageId: message.id,
            conversationId,
            userId: participantId,
            deliveredAt: hoursAgo(0.7 + index),
            readAt:
              participantId === message.senderId
                ? message.createdAt
                : participantId === left && message.senderId !== left
                  ? null
                  : hoursAgo(0.6 + index),
          });
        }
      }
    }
  }
}

class DatabaseChatService implements ChatService {
  private eventPublisher: ((event: RealtimeEvent) => void) | null = null;

  setEventPublisher(publisher: ((event: RealtimeEvent) => void) | null) {
    this.eventPublisher = publisher;
  }

  listSupportedCountries() {
    return {
      countries: getCountries()
        .map((code) => ({
          code,
          name: displayCountryName(code),
          callingCode: `+${getCountryCallingCode(code)}`,
          flag: flagFromCountryCode(code),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    };
  }

  async requestOtp(input: { phone: string; countryCode: string; forceDemoCode?: boolean }) {
    this.requireDatabase();
    const normalized = normalizePhone(input.phone, input.countryCode);
    const requestId = randomId("otp");
    const rawCode = randomOtpCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.cleanupExpiredOtpRequests();
    await db!.insert(otpCodesTable).values({
      id: requestId,
      phone: normalized.e164,
      normalizedPhone: normalized.e164,
      countryCode: normalized.countryCode,
      codeHash: sha256(rawCode),
      attempts: 0,
      expiresAt,
      consumedAt: null,
    });

    const isProduction = process.env["NODE_ENV"] === "production";
    const smsResult = await sendOtpSms({
      phoneE164: normalized.e164,
      code: rawCode,
      countryCode: normalized.countryCode,
    }).catch((error: unknown) => {
      if (isProduction) {
        throw error instanceof Error ? error : new Error("Impossible d'envoyer le SMS OTP");
      }
      logger.warn({ err: error }, "OTP SMS failed in development");
      return { sent: false as const, provider: null, reason: "disabled" as const };
    });

    if (isProduction && !smsResult.sent) {
      if (smsResult.reason === "unsupported_region") {
        throw new Error(
          "Les SMS de verification ne sont pas encore disponibles pour ce pays. Utilisez un numero africain ou reessayez plus tard.",
        );
      }
      if (smsResult.reason === "disabled") {
        throw new Error("L'envoi SMS OTP n'est pas active sur le serveur");
      }
    }

    const exposeDemoCode = shouldExposeOtpDemoCode() || input.forceDemoCode;
    if (exposeDemoCode) {
      logger.info(
        { phone: normalized.e164, requestId, otpDemoCode: rawCode },
        "OTP demo code generated",
      );
    }

    return {
      requestId,
      expiresAt: expiresAt.toISOString(),
      demoCode: exposeDemoCode ? rawCode : null,
    };
  }

  async verifyOtp(input: { requestId: string; phone: string; code: string }) {
    this.requireDatabase();
    const [request] = await db!
      .select()
      .from(otpCodesTable)
      .where(eq(otpCodesTable.id, input.requestId))
      .limit(1);

    if (!request) {
      throw new Error("Demande OTP introuvable");
    }

    const normalized = normalizePhone(input.phone, request.countryCode);
    if (normalized.e164 !== request.normalizedPhone) {
      throw new Error("Le numéro ne correspond pas à la demande OTP");
    }

    if (request.consumedAt) {
      throw new Error("Ce code a déjà été utilisé");
    }

    if (request.expiresAt.getTime() < Date.now()) {
      throw new Error("Le code OTP a expiré");
    }

    if (request.attempts >= MAX_OTP_ATTEMPTS) {
      throw new Error("Trop de tentatives OTP, veuillez recommencer");
    }

    const providedCodeHash = sha256(input.code.trim());
    if (!secureStringEqual(request.codeHash, providedCodeHash)) {
      await db!
        .update(otpCodesTable)
        .set({ attempts: request.attempts + 1 })
        .where(eq(otpCodesTable.id, request.id));
      throw new Error("Code OTP invalide");
    }

    await db!
      .update(otpCodesTable)
      .set({ consumedAt: new Date() })
      .where(eq(otpCodesTable.id, request.id));

    let user = await this.findUserByNormalizedPhone(normalized.e164);
    if (!user) {
      const createdUser = {
        id: randomId("user"),
        phone: normalized.e164,
        normalizedPhone: normalized.e164,
        countryCode: normalized.countryCode,
        name: "",
        avatarUrl: null,
        bio: "",
        statusText: "Disponible",
        color: pickUserColor(normalized.e164),
        isOnboarded: false,
        lastSeenVisibility: "everyone" as const,
        readReceiptsEnabled: true,
        notificationsEnabled: true,
        notificationSoundEnabled: true,
        vibrationEnabled: true,
        autoDownloadMedia: true,
        lowDataMode: false,
        chatFontScale: "medium" as const,
        isOnline: true,
        lastSeenAt: null,
        updatedAt: new Date(),
      };
      await db!.insert(usersTable).values(createdUser);
      user = { ...createdUser, createdAt: new Date() };
    } else {
      await db!
        .update(usersTable)
        .set({ isOnline: true, lastSeenAt: null, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));
      user = { ...user, isOnline: true, lastSeenAt: null };
    }

    const rawToken = randomId("token");
    await db!.insert(sessionsTable).values({
      id: randomId("session"),
      userId: user.id,
      tokenHash: sha256(rawToken),
      lastSeenAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    return {
      token: rawToken,
      user: await this.toUserProfile(user.id, user.id),
    };
  }

  async getCurrentUser(token: string) {
    const user = await this.requireUserByToken(token);
    return this.toUserProfile(user.id, user.id);
  }

  async updateCurrentUser(
    token: string,
    updates: Partial<Pick<UserProfile, "name" | "avatarUrl" | "bio" | "statusText">> &
      Partial<UserSettings>,
  ) {
    const user = await this.requireUserByToken(token);
    const nextName = updates.name ?? user.name;

    await db!
      .update(usersTable)
      .set({
        name: nextName,
        avatarUrl: updates.avatarUrl === undefined ? user.avatarUrl : updates.avatarUrl,
        bio: updates.bio ?? user.bio,
        statusText: updates.statusText ?? user.statusText,
        lastSeenVisibility: updates.lastSeenVisibility ?? user.lastSeenVisibility,
        readReceiptsEnabled: updates.readReceiptsEnabled ?? user.readReceiptsEnabled,
        notificationsEnabled: updates.notificationsEnabled ?? user.notificationsEnabled,
        notificationSoundEnabled:
          updates.notificationSoundEnabled ?? user.notificationSoundEnabled,
        vibrationEnabled: updates.vibrationEnabled ?? user.vibrationEnabled,
        autoDownloadMedia: updates.autoDownloadMedia ?? user.autoDownloadMedia,
        lowDataMode: updates.lowDataMode ?? user.lowDataMode,
        chatFontScale: updates.chatFontScale ?? user.chatFontScale,
        isOnboarded: Boolean(nextName.trim()),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    return this.toUserProfile(user.id, user.id);
  }

  async updatePresenceHeartbeat(token: string, isOnline: boolean) {
    const user = await this.requireUserByToken(token);

    if (user.isOnline === isOnline) {
      return this.toPresenceSnapshot(user.id, user.id);
    }

    await db!
      .update(usersTable)
      .set({
        isOnline,
        lastSeenAt: isOnline ? null : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    const snapshot = await this.toPresenceSnapshot(user.id, user.id);
    const participantIds = await this.listPresenceSubscribers(user.id);
    this.publish({
      type: "presence.updated",
      participantIds,
      presence: { userId: user.id, snapshot },
    });

    return snapshot;
  }

  async listConversations(token: string) {
    const user = await this.requireUserByToken(token);
    const memberships = await db!
      .select()
      .from(conversationMembersTable)
      .where(eq(conversationMembersTable.userId, user.id));

    const conversations = await Promise.all(
      memberships.map((membership) => this.toConversationSummary(membership.conversationId, user.id)),
    );

    conversations.sort((a, b) =>
      (b.lastMessage?.createdAt ?? "").localeCompare(a.lastMessage?.createdAt ?? ""),
    );

    return { conversations };
  }

  async createConversation(
    token: string,
    input: {
      participantUserIds: string[];
      participantPhones: string[];
      title: string | null;
    },
  ) {
    const currentUser = await this.requireUserByToken(token);
    const participantIds = new Set<string>([currentUser.id]);

    if (input.participantUserIds.length > 0) {
      const existingUsers = await db!
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(inArray(usersTable.id, input.participantUserIds));
      for (const user of existingUsers) participantIds.add(user.id);
    }

    for (const phone of input.participantPhones) {
      const normalized = normalizePhone(phone);
      const user = await this.findUserByNormalizedPhone(normalized.e164);
      if (user) participantIds.add(user.id);
    }

    const ids = Array.from(participantIds);
    if (ids.length < 2) {
      throw new Error("Au moins deux participants sont nécessaires");
    }
    if (ids.length > MAX_GROUP_MEMBERS) {
      throw new Error("Le groupe dépasse la limite de participants autorisés");
    }

    const normalizedTitle = input.title?.trim() || null;
    const type: ConversationType = ids.length === 2 && !normalizedTitle ? "direct" : "group";

    if (type === "direct") {
      const existing = await this.findExistingDirectConversation(ids);
      if (existing) {
        return this.toConversationSummary(existing, currentUser.id);
      }
    }

    const conversationId = randomId("conv");
    const now = new Date();

    await db!.insert(conversationsTable).values({
      id: conversationId,
      type,
      title: normalizedTitle,
      createdBy: currentUser.id,
      createdAt: now,
      updatedAt: now,
    });

    await db!.insert(conversationMembersTable).values(
      ids.map((userId) => ({
        conversationId,
        userId,
        unreadCount: 0,
        lastReadMessageId: null,
      })),
    );

    const summary = await this.toConversationSummary(conversationId, currentUser.id);
    this.publish({
      type: "conversation.created",
      participantIds: ids,
      conversation: summary,
    });

    return summary;
  }

  async getConversation(token: string, conversationId: string) {
    const user = await this.requireUserByToken(token);
    await this.requireConversationMembership(conversationId, user.id);
    return this.toConversationSummary(conversationId, user.id);
  }

  async updateConversation(
    token: string,
    conversationId: string,
    input: { title?: string | null; avatarUrl?: string | null },
  ) {
    const user = await this.requireUserByToken(token);
    const conversation = await this.requireConversationMembership(conversationId, user.id);

    if (conversation.type !== "group") {
      throw new Error("Seuls les groupes peuvent être modifiés");
    }
    if (conversation.createdBy !== user.id) {
      throw new Error("Seul l'administrateur du groupe peut modifier ces informations");
    }

    const updates: {
      title?: string | null;
      avatarUrl?: string | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (input.title !== undefined) {
      updates.title = input.title?.trim() ? input.title.trim() : null;
    }
    if (input.avatarUrl !== undefined) {
      updates.avatarUrl = input.avatarUrl?.trim() ? input.avatarUrl.trim() : null;
    }

    await db!
      .update(conversationsTable)
      .set(updates)
      .where(eq(conversationsTable.id, conversationId));

    const participantIds = await this.getConversationParticipantIds(conversationId);
    const summary = await this.toConversationSummary(conversationId, user.id);
    this.publish({
      type: "conversation.updated",
      participantIds,
      conversationId,
      conversation: summary,
    });

    return summary;
  }

  async addConversationMembers(
    token: string,
    conversationId: string,
    input: { participantUserIds: string[]; participantPhones: string[] },
  ) {
    const user = await this.requireUserByToken(token);
    const conversation = await this.requireConversationMembership(conversationId, user.id);

    if (conversation.type !== "group") {
      throw new Error("Impossible d'ajouter des membres à une conversation directe");
    }

    const existingMemberIds = new Set(await this.getConversationParticipantIds(conversationId));
    const newMemberIds = new Set<string>();

    if (input.participantUserIds.length > 0) {
      const existingUsers = await db!
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(inArray(usersTable.id, input.participantUserIds));
      for (const matchedUser of existingUsers) {
        if (!existingMemberIds.has(matchedUser.id)) {
          newMemberIds.add(matchedUser.id);
        }
      }
    }

    for (const phone of input.participantPhones) {
      const normalized = normalizePhone(phone);
      const matchedUser = await this.findUserByNormalizedPhone(normalized.e164);
      if (matchedUser && !existingMemberIds.has(matchedUser.id)) {
        newMemberIds.add(matchedUser.id);
      }
    }

    if (newMemberIds.size === 0) {
      return this.toConversationSummary(conversationId, user.id);
    }

    const totalMembers = existingMemberIds.size + newMemberIds.size;
    if (totalMembers > MAX_GROUP_MEMBERS) {
      throw new Error("Le groupe dépasse la limite de participants autorisés");
    }

    await db!.insert(conversationMembersTable).values(
      Array.from(newMemberIds).map((memberId) => ({
        conversationId,
        userId: memberId,
        unreadCount: 0,
        lastReadMessageId: null,
      })),
    );

    await db!
      .update(conversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(conversationsTable.id, conversationId));

    const participantIds = await this.getConversationParticipantIds(conversationId);
    const summary = await this.toConversationSummary(conversationId, user.id);
    this.publish({
      type: "member.added",
      participantIds,
      conversationId,
      conversation: summary,
    });

    return summary;
  }

  async removeConversationMember(token: string, conversationId: string, targetUserId: string) {
    const user = await this.requireUserByToken(token);
    const conversation = await this.requireConversationMembership(conversationId, user.id);

    if (conversation.type !== "group") {
      throw new Error("Impossible de retirer un membre d'une conversation directe");
    }

    const isSelf = targetUserId === user.id;
    if (!isSelf && conversation.createdBy !== user.id) {
      throw new Error("Seul l'administrateur du groupe peut retirer un membre");
    }

    await this.requireMembershipRecord(conversationId, targetUserId);

    const memberIds = await this.getConversationParticipantIds(conversationId);
    if (memberIds.length <= 2) {
      throw new Error("Un groupe doit contenir au moins deux membres");
    }

    await db!
      .delete(conversationMembersTable)
      .where(
        and(
          eq(conversationMembersTable.conversationId, conversationId),
          eq(conversationMembersTable.userId, targetUserId),
        ),
      );

    if (conversation.createdBy === targetUserId) {
      const [nextAdmin] = await db!
        .select({ userId: conversationMembersTable.userId })
        .from(conversationMembersTable)
        .where(
          and(
            eq(conversationMembersTable.conversationId, conversationId),
            ne(conversationMembersTable.userId, targetUserId),
          ),
        )
        .orderBy(conversationMembersTable.joinedAt)
        .limit(1);

      if (nextAdmin) {
        await db!
          .update(conversationsTable)
          .set({ createdBy: nextAdmin.userId, updatedAt: new Date() })
          .where(eq(conversationsTable.id, conversationId));
      }
    }

    await db!
      .update(conversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(conversationsTable.id, conversationId));

    const participantIds = await this.getConversationParticipantIds(conversationId);
    const summary = await this.toConversationSummary(conversationId, user.id);
    this.publish({
      type: "member.removed",
      participantIds: [...participantIds, targetUserId],
      conversationId,
      conversation: summary,
      removedUserId: targetUserId,
    });

    return summary;
  }

  async leaveConversation(token: string, conversationId: string) {
    const user = await this.requireUserByToken(token);
    await this.removeConversationMember(token, conversationId, user.id);
    return { conversationId };
  }

  async createGroupInvite(token: string, conversationId: string) {
    const user = await this.requireUserByToken(token);
    const conversation = await this.requireConversationMembership(conversationId, user.id);

    if (conversation.type !== "group") {
      throw new Error("Seuls les groupes peuvent avoir un lien d'invitation");
    }

    const inviteToken = randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + GROUP_INVITE_TTL_MS);

    await db!.insert(groupInvitesTable).values({
      token: inviteToken,
      conversationId,
      createdBy: user.id,
      expiresAt,
    });

    return {
      token: inviteToken,
      inviteUrl: buildGroupInviteUrl(inviteToken),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getGroupInvitePreview(token: string, inviteToken: string) {
    await this.requireUserByToken(token);
    const invite = await this.requireActiveGroupInvite(inviteToken);
    const [conversation] = await db!
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, invite.conversationId))
      .limit(1);

    if (!conversation || conversation.type !== "group") {
      throw new Error("Invitation invalide");
    }

    const memberIds = await this.getConversationParticipantIds(conversation.id);

    return {
      token: invite.token,
      conversationId: conversation.id,
      title: conversation.title,
      avatarUrl: conversation.avatarUrl ?? null,
      memberCount: memberIds.length,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  async joinGroupByInvite(token: string, inviteToken: string) {
    const user = await this.requireUserByToken(token);
    const invite = await this.requireActiveGroupInvite(inviteToken);
    const [conversation] = await db!
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, invite.conversationId))
      .limit(1);

    if (!conversation || conversation.type !== "group") {
      throw new Error("Invitation invalide");
    }

    const existingMemberIds = await this.getConversationParticipantIds(conversation.id);
    if (existingMemberIds.includes(user.id)) {
      return this.toConversationSummary(conversation.id, user.id);
    }

    if (existingMemberIds.length >= MAX_GROUP_MEMBERS) {
      throw new Error("Ce groupe est complet");
    }

    await db!.insert(conversationMembersTable).values({
      conversationId: conversation.id,
      userId: user.id,
      unreadCount: 0,
      lastReadMessageId: null,
    });

    await db!
      .update(groupInvitesTable)
      .set({ useCount: invite.useCount + 1 })
      .where(eq(groupInvitesTable.token, invite.token));

    await db!
      .update(conversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(conversationsTable.id, conversation.id));

    const participantIds = await this.getConversationParticipantIds(conversation.id);
    const summary = await this.toConversationSummary(conversation.id, user.id);
    this.publish({
      type: "member.added",
      participantIds,
      conversationId: conversation.id,
      conversation: summary,
    });

    return summary;
  }

  private async requireActiveGroupInvite(inviteToken: string) {
    const [invite] = await db!
      .select()
      .from(groupInvitesTable)
      .where(eq(groupInvitesTable.token, inviteToken))
      .limit(1);

    if (!invite) {
      throw new Error("Invitation introuvable");
    }
    if (invite.revokedAt) {
      throw new Error("Cette invitation n'est plus valide");
    }
    if (invite.expiresAt.getTime() <= Date.now()) {
      throw new Error("Cette invitation a expiré");
    }

    return invite;
  }

  async listConversationMessages(
    token: string,
    conversationId: string,
    params: { cursor?: string; limit?: number },
  ) {
    const user = await this.requireUserByToken(token);
    await this.requireConversationMembership(conversationId, user.id);

    const all = await db!
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(desc(messagesTable.createdAt));

    let startIndex = 0;
    if (params.cursor) {
      const foundIndex = all.findIndex((message) => message.id === params.cursor);
      startIndex = foundIndex >= 0 ? foundIndex + 1 : 0;
    }

    const limit = params.limit ?? 50;
    const page = all.slice(startIndex, startIndex + limit);
    const nextCursor = startIndex + limit < all.length ? page.at(-1)?.id ?? null : null;

    return {
      messages: await Promise.all(
        page
          .slice()
          .reverse()
          .map((message) => this.toMessage(message.conversationId, message.id)),
      ),
      nextCursor,
    };
  }

  async sendConversationMessage(
    token: string,
    conversationId: string,
    input: { content: string; type: MessageType },
    authenticatedUserId?: string,
  ) {
    const sender = authenticatedUserId
      ? await this.requireUserById(authenticatedUserId)
      : await this.requireUserByToken(token);
    const conversation = await this.requireConversationMembership(conversationId, sender.id);
    const memberships = await db!
      .select()
      .from(conversationMembersTable)
      .where(eq(conversationMembersTable.conversationId, conversationId));
    const participantIds = memberships.map((membership) => membership.userId);
    const normalizedContent = input.content.trim();

    if (!normalizedContent) {
      throw new Error("Le message ne peut pas être vide");
    }
    if (normalizedContent.length > MAX_MESSAGE_LENGTH) {
      throw new Error("Le message est trop long");
    }

    const messageId = randomId("msg");
    const createdAt = new Date();
    const createdAtIso = createdAt.toISOString();
    const initialReceipts = memberships.map((membership) => ({
      messageId,
      conversationId,
      userId: membership.userId,
      deliveredAt: membership.userId === sender.id ? createdAt : null,
      readAt: membership.userId === sender.id ? createdAt : null,
    }));

    await db!.insert(messagesTable).values({
      id: messageId,
      conversationId,
      senderId: sender.id,
      content: normalizedContent,
      type: input.type,
      createdAt,
    });

    const fullMessage: ConversationMessage = {
      id: messageId,
      conversationId,
      senderId: sender.id,
      content: normalizedContent,
      type: input.type,
      createdAt: createdAtIso,
      receipts: initialReceipts.map((receipt) => ({
        messageId: receipt.messageId,
        conversationId: receipt.conversationId,
        userId: receipt.userId,
        deliveredAt: toIso(receipt.deliveredAt),
        readAt: toIso(receipt.readAt),
      })),
    };

    this.publish({
      type: "message.created",
      participantIds,
      conversationId,
      message: fullMessage,
    });

    void (async () => {
      await db!
        .update(conversationsTable)
        .set({ updatedAt: createdAt })
        .where(eq(conversationsTable.id, conversation.id));

      if (memberships.length > 0) {
        await db!
          .insert(messageReceiptsTable)
          .values(initialReceipts)
          .onConflictDoNothing();

        await Promise.all(
          memberships.map((membership) =>
            db!
              .update(conversationMembersTable)
              .set({
                lastReadMessageId:
                  membership.userId === sender.id ? messageId : membership.lastReadMessageId,
                unreadCount:
                  membership.userId === sender.id
                    ? membership.unreadCount
                    : membership.unreadCount + 1,
              })
              .where(
                and(
                  eq(conversationMembersTable.conversationId, conversationId),
                  eq(conversationMembersTable.userId, membership.userId),
                ),
              ),
          ),
        );
      }

      const offlineRecipients = await db!
        .select({
          id: deviceTokensTable.id,
          userId: deviceTokensTable.userId,
          pushToken: deviceTokensTable.pushToken,
          platform: deviceTokensTable.platform,
          deviceName: deviceTokensTable.deviceName,
        })
        .from(deviceTokensTable)
        .innerJoin(usersTable, eq(usersTable.id, deviceTokensTable.userId))
        .where(
          and(
            inArray(deviceTokensTable.userId, participantIds.filter((id) => id !== sender.id)),
            eq(usersTable.isOnline, false),
            eq(usersTable.notificationsEnabled, true),
          ),
        );

      await sendExpoPushMessages(
        offlineRecipients,
        sender.name || "Gbairai",
        normalizedContent,
      );
    })().catch((error: unknown) => {
      logger.warn({ err: error, conversationId, messageId }, "Post-send message work failed");
    });

    return fullMessage;
  }

  async deleteConversationMessage(token: string, messageId: string) {
    const user = await this.requireUserByToken(token);
    const [message] = await db!
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.id, messageId))
      .limit(1);

    if (!message) {
      throw new Error("Message introuvable");
    }

    await this.requireConversationMembership(message.conversationId, user.id);

    if (message.senderId !== user.id) {
      throw new Error("Vous ne pouvez supprimer que vos propres messages");
    }

    if (Date.now() - message.createdAt.getTime() > MESSAGE_DELETE_WINDOW_MS) {
      throw new Error("Vous ne pouvez pas supprimer ce message après 15 minutes");
    }

    const participantIds = await this.getConversationParticipantIds(message.conversationId);
    const receipts = await db!
      .select()
      .from(messageReceiptsTable)
      .where(eq(messageReceiptsTable.messageId, message.id));

    for (const receipt of receipts) {
      if (receipt.userId === user.id || receipt.readAt) {
        continue;
      }
      const membership = await this.requireMembershipRecord(message.conversationId, receipt.userId);
      await db!
        .update(conversationMembersTable)
        .set({ unreadCount: Math.max(0, membership.unreadCount - 1) })
        .where(
          and(
            eq(conversationMembersTable.conversationId, message.conversationId),
            eq(conversationMembersTable.userId, receipt.userId),
          ),
        );
    }

    await db!.delete(messagesTable).where(eq(messagesTable.id, message.id));

    const [latestMessage] = await db!
      .select({ createdAt: messagesTable.createdAt })
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, message.conversationId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(1);

    await db!
      .update(conversationsTable)
      .set({ updatedAt: latestMessage?.createdAt ?? new Date() })
      .where(eq(conversationsTable.id, message.conversationId));

    this.publish({
      type: "message.deleted",
      participantIds,
      conversationId: message.conversationId,
      messageId: message.id,
    });

    return {
      messageId: message.id,
      conversationId: message.conversationId,
    };
  }

  async updateConversationMessage(
    token: string,
    messageId: string,
    input: { content: string },
  ) {
    const user = await this.requireUserByToken(token);
    const [message] = await db!
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.id, messageId))
      .limit(1);

    if (!message) {
      throw new Error("Message introuvable");
    }

    await this.requireConversationMembership(message.conversationId, user.id);

    if (message.senderId !== user.id) {
      throw new Error("Vous ne pouvez modifier que vos propres messages");
    }

    if (Date.now() - message.createdAt.getTime() > MESSAGE_DELETE_WINDOW_MS) {
      throw new Error("Vous ne pouvez pas modifier ce message après 15 minutes");
    }

    if (message.type !== "text") {
      throw new Error("Seuls les messages texte peuvent être modifiés");
    }

    const normalizedContent = input.content.trim();
    if (!normalizedContent) {
      throw new Error("Le message ne peut pas être vide");
    }
    if (normalizedContent.length > MAX_MESSAGE_LENGTH) {
      throw new Error("Message trop long");
    }

    await db!
      .update(messagesTable)
      .set({ content: normalizedContent })
      .where(eq(messagesTable.id, message.id));

    const fullMessage = await this.toMessage(message.conversationId, message.id);
    const participantIds = await this.getConversationParticipantIds(message.conversationId);

    this.publish({
      type: "message.updated",
      participantIds,
      conversationId: message.conversationId,
      message: fullMessage,
    });

    return fullMessage;
  }

  async markConversationRead(
    token: string,
    conversationId: string,
    input: { messageId: string },
  ) {
    const user = await this.requireUserByToken(token);
    const participantIds = await this.getConversationParticipantIds(conversationId);
    await this.requireConversationMembership(conversationId, user.id);

    const [targetMessage] = await db!
      .select()
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.id, input.messageId),
          eq(messagesTable.conversationId, conversationId),
        ),
      )
      .limit(1);

    if (!targetMessage) {
      throw new Error("Message introuvable");
    }

    const readAt = new Date();
    const receipt: MessageReceipt = {
      messageId: input.messageId,
      conversationId,
      userId: user.id,
      deliveredAt: readAt.toISOString(),
      readAt: readAt.toISOString(),
    };

    this.publish({
      type: "message.receipt",
      participantIds,
      conversationId,
      receipt,
    });

    void (async () => {
      const candidateMessages = await db!
        .select()
        .from(messagesTable)
        .where(
          and(
            eq(messagesTable.conversationId, conversationId),
            ne(messagesTable.senderId, user.id),
            lte(messagesTable.createdAt, targetMessage.createdAt),
          ),
        );

      for (const message of candidateMessages) {
        const [current] = await db!
          .select()
          .from(messageReceiptsTable)
          .where(
            and(
              eq(messageReceiptsTable.messageId, message.id),
              eq(messageReceiptsTable.userId, user.id),
            ),
          )
          .limit(1);

        const deliveredAt = current?.deliveredAt ?? readAt;
        await db!
          .insert(messageReceiptsTable)
          .values({
            messageId: message.id,
            conversationId,
            userId: user.id,
            deliveredAt,
            readAt,
          })
          .onConflictDoUpdate({
            target: [messageReceiptsTable.messageId, messageReceiptsTable.userId],
            set: { deliveredAt, readAt },
          });
      }

      await db!
        .update(conversationMembersTable)
        .set({
          unreadCount: 0,
          lastReadMessageId: input.messageId,
        })
        .where(
          and(
            eq(conversationMembersTable.conversationId, conversationId),
            eq(conversationMembersTable.userId, user.id),
          ),
        );
    })().catch((error: unknown) => {
      logger.warn({ err: error, conversationId, messageId: input.messageId }, "Post-read receipt work failed");
    });

    return receipt;
  }

  async markMessageDelivered(token: string, messageId: string) {
    const user = await this.requireUserByToken(token);
    const [message] = await db!
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.id, messageId))
      .limit(1);

    if (!message) {
      throw new Error("Message introuvable");
    }

    const participantIds = await this.getConversationParticipantIds(message.conversationId);
    await this.requireConversationMembership(message.conversationId, user.id);

    const [current] = await db!
      .select()
      .from(messageReceiptsTable)
      .where(
        and(
          eq(messageReceiptsTable.messageId, messageId),
          eq(messageReceiptsTable.userId, user.id),
        ),
      )
      .limit(1);

    const deliveredAt = current?.deliveredAt ?? new Date();
    const readAt = current?.readAt ?? null;

    await db!
      .insert(messageReceiptsTable)
      .values({
        messageId,
        conversationId: message.conversationId,
        userId: user.id,
        deliveredAt,
        readAt,
      })
      .onConflictDoUpdate({
        target: [messageReceiptsTable.messageId, messageReceiptsTable.userId],
        set: { deliveredAt, readAt },
      });

    const receipt: MessageReceipt = {
      messageId,
      conversationId: message.conversationId,
      userId: user.id,
      deliveredAt: deliveredAt.toISOString(),
      readAt: readAt ? readAt.toISOString() : null,
    };

    this.publish({
      type: "message.receipt",
      participantIds,
      conversationId: message.conversationId,
      receipt,
    });

    return receipt;
  }

  async syncContacts(
    token: string,
    input: { contacts: Array<{ name: string; phone: string }> },
  ) {
    const user = await this.requireUserByToken(token);
    if (input.contacts.length > MAX_SYNC_CONTACTS) {
      throw new Error("Trop de contacts à synchroniser en une seule requête");
    }

    const normalizedContacts = new Map<string, { contactName: string; phone: string }>();
    for (const contact of input.contacts) {
      try {
        const normalized = normalizePhone(contact.phone, user.countryCode);
        if (!normalizedContacts.has(normalized.e164)) {
          normalizedContacts.set(normalized.e164, {
            contactName: contact.name.trim() || normalized.e164,
            phone: normalized.e164,
          });
        }
      } catch {
        // Ignore malformed numbers from address books.
      }
    }

    const normalizedPhones = Array.from(normalizedContacts.keys());
    if (!normalizedPhones.length) {
      await db!.delete(contactEdgesTable).where(eq(contactEdgesTable.ownerUserId, user.id));
      return { matches: [] };
    }

    const matchedUsers = await db!
      .select()
      .from(usersTable)
      .where(inArray(usersTable.normalizedPhone, normalizedPhones));

    const matchedUsersByPhone = new Map(
      matchedUsers.map((matchedUser) => [matchedUser.normalizedPhone, matchedUser] as const),
    );

    await db!.delete(contactEdgesTable).where(eq(contactEdgesTable.ownerUserId, user.id));
    await db!.insert(contactEdgesTable).values(
      normalizedPhones.map((phone) => {
        const contact = normalizedContacts.get(phone)!;
        const matchedUser = matchedUsersByPhone.get(phone);
        return {
          ownerUserId: user.id,
          normalizedPhone: phone,
          contactName: contact.contactName,
          matchedUserId: matchedUser?.id ?? null,
        };
      }),
    );

    const matchedUserIds = new Set<string>();
    const pendingMatches: Array<{ contactName: string; phone: string; userId: string }> = [];

    for (const [phone, contact] of normalizedContacts.entries()) {
      const matched = matchedUsersByPhone.get(phone);
      if (!matched || matched.id === user.id) continue;
      matchedUserIds.add(matched.id);
      pendingMatches.push({
        contactName: contact.contactName,
        phone,
        userId: matched.id,
      });
    }

    const profiles = new Map<string, UserProfile>();
    for (const matchedUserId of matchedUserIds) {
      profiles.set(matchedUserId, await this.toUserProfile(matchedUserId, user.id));
    }

    const matches = pendingMatches
      .map((match) => {
        const profile = profiles.get(match.userId);
        if (!profile) return null;
        return {
          contactName: match.contactName,
          phone: match.phone,
          user: profile,
        };
      })
      .filter((match): match is NonNullable<typeof match> => Boolean(match));

    return { matches };
  }

  async registerDeviceToken(
    token: string,
    input: { pushToken: string; platform: string; deviceName: string },
  ) {
    const user = await this.requireUserByToken(token);
    if (input.deviceName.trim().length === 0) {
      throw new Error("Le nom de l'appareil est requis");
    }
    if (input.deviceName.length > MAX_DEVICE_NAME_LENGTH) {
      throw new Error("Le nom de l'appareil est trop long");
    }

    const id = randomId("device");
    await db!
      .insert(deviceTokensTable)
      .values({
        id,
        userId: user.id,
        pushToken: input.pushToken,
        platform: input.platform,
        deviceName: input.deviceName,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: deviceTokensTable.pushToken,
        set: {
          userId: user.id,
          platform: input.platform,
          deviceName: input.deviceName,
          updatedAt: new Date(),
        },
      });

    const [device] = await db!
      .select()
      .from(deviceTokensTable)
      .where(eq(deviceTokensTable.pushToken, input.pushToken))
      .limit(1);

    if (!device) {
      throw new Error("Impossible d'enregistrer l'appareil");
    }

    return {
      id: device.id,
      pushToken: device.pushToken,
      platform: device.platform,
      deviceName: device.deviceName,
    };
  }

  async listStories(token: string) {
    const viewer = await this.requireUserByToken(token);
    await db!.delete(storiesTable).where(lte(storiesTable.expiresAt, new Date()));
    const stories = await db!
      .select()
      .from(storiesTable)
      .where(gte(storiesTable.expiresAt, new Date()))
      .orderBy(desc(storiesTable.createdAt));

    const visibleStories: typeof stories = [];
    for (const story of stories) {
      if (await this.canViewStory(viewer.id, story.userId)) {
        visibleStories.push(story);
      }
    }

    return {
      stories: await Promise.all(
        visibleStories.map((story) => this.toStorySummary(story.id, viewer.id)),
      ),
    };
  }

  async createStory(
    token: string,
    input: { type: StoryType; content: string; backgroundColor?: string },
  ) {
    const user = await this.requireUserByToken(token);
    const storyId = randomId("story");
    const now = new Date();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);

    await db!.insert(storiesTable).values({
      id: storyId,
      userId: user.id,
      type: input.type,
      content: input.content.trim(),
      backgroundColor: input.backgroundColor?.trim() || "#6D4AFF",
      expiresAt,
      createdAt: now,
    });

    await db!.insert(storyViewsTable).values({
      storyId,
      viewerUserId: user.id,
      createdAt: now,
    });

    return this.toStorySummary(storyId, user.id);
  }

  async addStoryView(token: string, storyId: string) {
    const viewer = await this.requireUserByToken(token);
    const [story] = await db!
      .select()
      .from(storiesTable)
      .where(and(eq(storiesTable.id, storyId), gte(storiesTable.expiresAt, new Date())))
      .limit(1);

    if (!story) {
      throw new Error("Statut introuvable");
    }

    if (!(await this.canViewStory(viewer.id, story.userId))) {
      throw new Error("Ce statut n'est visible que par les contacts enregistrés");
    }

    await db!
      .insert(storyViewsTable)
      .values({
        storyId,
        viewerUserId: viewer.id,
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    return this.toStorySummary(storyId, viewer.id);
  }

  async replyToStory(
    token: string,
    storyId: string,
    input: { text?: string; emoji?: string },
  ) {
    const viewer = await this.requireUserByToken(token);
    const [story] = await db!
      .select()
      .from(storiesTable)
      .where(and(eq(storiesTable.id, storyId), gte(storiesTable.expiresAt, new Date())))
      .limit(1);

    if (!story) {
      throw new Error("Statut introuvable ou expiré");
    }

    if (story.userId === viewer.id) {
      throw new Error("Vous ne pouvez pas répondre à votre propre statut");
    }

    if (!(await this.canViewStory(viewer.id, story.userId))) {
      throw new Error("Accès au statut refusé");
    }

    const trimmedText = input.text?.trim() ?? "";
    const emoji = input.emoji?.trim() ?? "";
    if (!trimmedText && !emoji) {
      throw new Error("Réponse vide");
    }
    if (trimmedText && emoji) {
      throw new Error("Envoyez soit un message, soit une réaction");
    }

    const content = emoji ? `${emoji} sur votre statut` : `Réponse à votre statut : ${trimmedText}`;

    const participantIds = [viewer.id, story.userId];
    let conversationId = await this.findExistingDirectConversation(participantIds);
    if (!conversationId) {
      const conversation = await this.createConversation(token, {
        participantUserIds: [story.userId],
        participantPhones: [],
        title: null,
      });
      conversationId = conversation.id;
    }

    return this.sendConversationMessage(
      token,
      conversationId,
      { content, type: "text" },
      viewer.id,
    );
  }

  async deleteStory(token: string, storyId: string) {
    const user = await this.requireUserByToken(token);
    const [story] = await db!
      .select()
      .from(storiesTable)
      .where(eq(storiesTable.id, storyId))
      .limit(1);

    if (!story) {
      throw new Error("Statut introuvable");
    }

    if (story.userId !== user.id) {
      throw new Error("Vous ne pouvez supprimer que vos propres statuts");
    }

    await db!.delete(storiesTable).where(eq(storiesTable.id, storyId));
    return { storyId };
  }

  async notifyIncomingCall(
    token: string,
    input: {
      conversationId: string;
      type: "audio" | "video";
      callerUserId: string;
      callerName: string;
    },
  ) {
    const user = await this.requireUserByToken(token);
    if (user.id !== input.callerUserId) {
      throw new Error("Appel non autorisé");
    }

    const participantIds = await this.getConversationParticipantIds(input.conversationId);
    this.publish({
      type: "call.invited",
      participantIds,
      conversationId: input.conversationId,
      callerUserId: input.callerUserId,
      callerName: input.callerName,
      callType: input.type,
    });

    const recipientIds = participantIds.filter((id) => id !== input.callerUserId);
    if (!recipientIds.length) {
      return;
    }

    const devices = await db!
      .select({
        pushToken: deviceTokensTable.pushToken,
        notificationSoundEnabled: usersTable.notificationSoundEnabled,
      })
      .from(deviceTokensTable)
      .innerJoin(usersTable, eq(usersTable.id, deviceTokensTable.userId))
      .where(
        and(
          inArray(deviceTokensTable.userId, recipientIds),
          eq(usersTable.notificationsEnabled, true),
        ),
      );

    await sendExpoIncomingCallPushes(devices, {
      callerName: input.callerName,
      conversationId: input.conversationId,
      callType: input.type,
      callerUserId: input.callerUserId,
    });
  }

  async resolveUserIdByToken(token: string) {
    const user = await this.requireUserByToken(token);
    return user.id;
  }

  private publish(event: RealtimeEvent) {
    this.eventPublisher?.(event);
  }

  private requireDatabase() {
    if (!db) {
      throw new Error("Base de données indisponible");
    }
  }

  private async cleanupExpiredOtpRequests() {
    await db!.delete(otpCodesTable).where(
      or(
        lte(otpCodesTable.expiresAt, new Date()),
        gte(otpCodesTable.attempts, MAX_OTP_ATTEMPTS),
      ),
    );
  }

  private async findUserByNormalizedPhone(phone: string) {
    const [user] = await db!
      .select()
      .from(usersTable)
      .where(eq(usersTable.normalizedPhone, phone))
      .limit(1);
    return user;
  }

  private async requireSession(token: string) {
    const tokenHash = sha256(token.trim());
    const [session] = await db!
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.tokenHash, tokenHash))
      .limit(1);

    if (!session) {
      throw new Error("Session invalide");
    }

    if (session.expiresAt.getTime() < Date.now()) {
      await db!.delete(sessionsTable).where(eq(sessionsTable.id, session.id));
      throw new Error("Session expirée");
    }

    await db!
      .update(sessionsTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(sessionsTable.id, session.id));

    return session;
  }

  private async requireUserByToken(token: string) {
    const session = await this.requireSession(token);
    return this.requireUserById(session.userId);
  }

  private async requireUserById(userId: string) {
    const [user] = await db!
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      throw new Error("Utilisateur introuvable");
    }

    return user;
  }

  private async requireMembershipRecord(conversationId: string, userId: string) {
    const [membership] = await db!
      .select()
      .from(conversationMembersTable)
      .where(
        and(
          eq(conversationMembersTable.conversationId, conversationId),
          eq(conversationMembersTable.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new Error("Conversation introuvable");
    }

    return membership;
  }

  private async requireConversationMembership(conversationId: string, userId: string) {
    await this.requireMembershipRecord(conversationId, userId);
    const [conversation] = await db!
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId))
      .limit(1);

    if (!conversation) {
      throw new Error("Conversation introuvable");
    }

    return conversation;
  }

  private async getConversationParticipantIds(conversationId: string) {
    const members = await db!
      .select({ userId: conversationMembersTable.userId })
      .from(conversationMembersTable)
      .where(eq(conversationMembersTable.conversationId, conversationId));
    return members.map((member) => member.userId);
  }

  private async listPresenceSubscribers(userId: string) {
    const memberships = await db!
      .select({ conversationId: conversationMembersTable.conversationId })
      .from(conversationMembersTable)
      .where(eq(conversationMembersTable.userId, userId));

    const conversationIds = memberships.map((membership) => membership.conversationId);
    const conversationMembers =
      conversationIds.length === 0
        ? []
        : await db!
            .select({ userId: conversationMembersTable.userId })
            .from(conversationMembersTable)
            .where(inArray(conversationMembersTable.conversationId, conversationIds));

    const contactOwners = await db!
      .select({ userId: contactEdgesTable.ownerUserId })
      .from(contactEdgesTable)
      .where(eq(contactEdgesTable.matchedUserId, userId));

    return Array.from(
      new Set([
        userId,
        ...conversationMembers.map((member) => member.userId),
        ...contactOwners.map((contact) => contact.userId),
      ]),
    );
  }

  private async toPresenceSnapshot(subjectUserId: string, viewerUserId: string): Promise<PresenceSnapshot> {
    const [user] = await db!
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, subjectUserId))
      .limit(1);

    if (!user) throw new Error("Utilisateur introuvable");

    if (subjectUserId === viewerUserId) {
      return {
        isOnline: user.isOnline,
        lastSeenAt: toIso(user.lastSeenAt),
      };
    }

    if (user.lastSeenVisibility === "nobody") {
      return { isOnline: false, lastSeenAt: null };
    }

    if (user.lastSeenVisibility === "contacts") {
      const [contact] = await db!
        .select()
        .from(contactEdgesTable)
        .where(
          and(
            eq(contactEdgesTable.ownerUserId, viewerUserId),
            eq(contactEdgesTable.normalizedPhone, user.normalizedPhone),
          ),
        )
        .limit(1);

      if (!contact) {
        return { isOnline: false, lastSeenAt: null };
      }
    }

    return {
      isOnline: user.isOnline,
      lastSeenAt: toIso(user.lastSeenAt),
    };
  }

  private async toUserProfile(subjectUserId: string, viewerUserId: string): Promise<UserProfile> {
    const [user] = await db!
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, subjectUserId))
      .limit(1);

    if (!user) {
      throw new Error("Utilisateur introuvable");
    }

    return {
      id: user.id,
      phone: user.phone,
      countryCode: user.countryCode,
      name: user.name || user.phone,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      statusText: user.statusText,
      initials: initialsFromName(user.name || user.phone),
      color: user.color,
      isOnboarded: user.isOnboarded,
      settings: {
        lastSeenVisibility: user.lastSeenVisibility,
        readReceiptsEnabled: user.readReceiptsEnabled,
        notificationsEnabled: user.notificationsEnabled,
        notificationSoundEnabled: user.notificationSoundEnabled,
        vibrationEnabled: user.vibrationEnabled,
        autoDownloadMedia: user.autoDownloadMedia,
        lowDataMode: user.lowDataMode,
        chatFontScale: user.chatFontScale,
      },
      presence: await this.toPresenceSnapshot(user.id, viewerUserId),
    };
  }

  private async toMessage(conversationId: string, messageId: string): Promise<ConversationMessage> {
    const [message] = await db!
      .select()
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.id, messageId),
          eq(messagesTable.conversationId, conversationId),
        ),
      )
      .limit(1);

    if (!message) {
      throw new Error("Message introuvable");
    }

    const receipts = await db!
      .select()
      .from(messageReceiptsTable)
      .where(eq(messageReceiptsTable.messageId, message.id));

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      type: message.type,
      createdAt: message.createdAt.toISOString(),
      receipts: receipts.map((receipt) => ({
        messageId: receipt.messageId,
        conversationId: receipt.conversationId,
        userId: receipt.userId,
        deliveredAt: toIso(receipt.deliveredAt),
        readAt: toIso(receipt.readAt),
      })),
    };
  }

  private async toConversationSummary(
    conversationId: string,
    viewerUserId: string,
  ): Promise<ConversationSummary> {
    const [conversation, membership] = await Promise.all([
      db!
        .select()
        .from(conversationsTable)
        .where(eq(conversationsTable.id, conversationId))
        .limit(1)
        .then((rows) => rows[0]),
      this.requireMembershipRecord(conversationId, viewerUserId),
    ]);

    if (!conversation) {
      throw new Error("Conversation introuvable");
    }

    const members = await db!
      .select()
      .from(conversationMembersTable)
      .where(eq(conversationMembersTable.conversationId, conversationId));

    const participants = await Promise.all(
      members.map(async (member) => ({
        userId: member.userId,
        profile: await this.toUserProfile(member.userId, viewerUserId),
      })),
    );

    const [lastMessage] = await db!
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(1);

    return {
      id: conversation.id,
      type: conversation.type,
      title: conversation.title,
      avatarUrl: conversation.avatarUrl ?? null,
      createdBy: conversation.createdBy,
      participants,
      unreadCount: membership.unreadCount,
      lastMessage: lastMessage ? await this.toMessage(conversationId, lastMessage.id) : undefined,
      lastReadMessageId: membership.lastReadMessageId,
    };
  }

  private async findExistingDirectConversation(participantIds: string[]) {
    const directMemberships = await db!
      .select({
        conversationId: conversationMembersTable.conversationId,
      })
      .from(conversationMembersTable)
      .innerJoin(
        conversationsTable,
        eq(conversationMembersTable.conversationId, conversationsTable.id),
      )
      .where(
        and(
          eq(conversationsTable.type, "direct"),
          inArray(conversationMembersTable.userId, participantIds),
        ),
      );

    const candidateIds = Array.from(new Set(directMemberships.map((row) => row.conversationId)));
    for (const candidateId of candidateIds) {
      const memberIds = await this.getConversationParticipantIds(candidateId);
      if (
        memberIds.length === participantIds.length &&
        memberIds.every((memberId) => participantIds.includes(memberId))
      ) {
        return candidateId;
      }
    }

    return null;
  }

  private async toStorySummary(storyId: string, viewerUserId: string): Promise<StorySummary> {
    const [story] = await db!
      .select()
      .from(storiesTable)
      .where(eq(storiesTable.id, storyId))
      .limit(1);

    if (!story) {
      throw new Error("Statut introuvable");
    }

    const views = await db!
      .select({ viewerUserId: storyViewsTable.viewerUserId })
      .from(storyViewsTable)
      .where(eq(storyViewsTable.storyId, story.id));

    const allViewerIds = views.map((view) => view.viewerUserId);
    const isOwner = story.userId === viewerUserId;
    const viewerIds = isOwner
      ? allViewerIds
      : allViewerIds.includes(viewerUserId)
        ? [viewerUserId]
        : [];

    return {
      id: story.id,
      userId: story.userId,
      type: story.type,
      content: story.content,
      backgroundColor: story.backgroundColor,
      expiresAt: story.expiresAt.toISOString(),
      viewerIds,
      createdAt: story.createdAt.toISOString(),
    };
  }

  private async canViewStory(viewerUserId: string, ownerUserId: string) {
    if (viewerUserId === ownerUserId) {
      return true;
    }

    const [contactEdge] = await db!
      .select({ ownerUserId: contactEdgesTable.ownerUserId })
      .from(contactEdgesTable)
      .where(
        and(
          eq(contactEdgesTable.ownerUserId, viewerUserId),
          eq(contactEdgesTable.matchedUserId, ownerUserId),
        ),
      )
      .limit(1);

    return Boolean(contactEdge);
  }
}

if (!hasDatabase || !db) {
  throw new Error(
    "DATABASE_URL est requis: le serveur chat ne peut plus démarrer avec un fallback mémoire.",
  );
}

export const chatService: ChatService = new DatabaseChatService();

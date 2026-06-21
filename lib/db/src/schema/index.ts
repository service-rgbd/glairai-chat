import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const conversationTypeEnum = pgEnum("conversation_type", ["direct", "group"]);
export const messageTypeEnum = pgEnum("message_type", ["text", "image", "audio", "video"]);
export const lastSeenVisibilityEnum = pgEnum("last_seen_visibility", [
  "everyone",
  "contacts",
  "nobody",
]);
export const chatFontScaleEnum = pgEnum("chat_font_scale", ["small", "medium", "large"]);
export const storyTypeEnum = pgEnum("story_type", ["text", "image", "video"]);
export const callSessionStatusEnum = pgEnum("call_session_status", [
  "ringing",
  "answered",
  "ended",
  "cancelled",
  "declined",
  "missed",
]);

export const usersTable = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    phone: text("phone").notNull(),
    normalizedPhone: text("normalized_phone").notNull(),
    countryCode: text("country_code").notNull(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    bio: text("bio").notNull().default(""),
    statusText: text("status_text").notNull().default("Disponible"),
    color: text("color").notNull().default("#6D4AFF"),
    isOnboarded: boolean("is_onboarded").notNull().default(false),
    lastSeenVisibility: lastSeenVisibilityEnum("last_seen_visibility")
      .notNull()
      .default("everyone"),
    readReceiptsEnabled: boolean("read_receipts_enabled").notNull().default(true),
    notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
    notificationSoundEnabled: boolean("notification_sound_enabled").notNull().default(true),
    vibrationEnabled: boolean("vibration_enabled").notNull().default(true),
    autoDownloadMedia: boolean("auto_download_media").notNull().default(true),
    lowDataMode: boolean("low_data_mode").notNull().default(false),
    chatFontScale: chatFontScaleEnum("chat_font_scale").notNull().default("medium"),
    isOnline: boolean("is_online").notNull().default(false),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    phoneIdx: uniqueIndex("users_normalized_phone_idx").on(table.normalizedPhone),
  }),
);

export const otpCodesTable = pgTable("otp_codes", {
  id: text("id").primaryKey(),
  phone: text("phone").notNull(),
  normalizedPhone: text("normalized_phone").notNull(),
  countryCode: text("country_code").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  normalizedPhoneIdx: index("otp_codes_normalized_phone_idx").on(table.normalizedPhone),
  expiresAtIdx: index("otp_codes_expires_at_idx").on(table.expiresAt),
}));

export const sessionsTable = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    userIdIdx: index("sessions_user_id_idx").on(table.userId),
    expiresAtIdx: index("sessions_expires_at_idx").on(table.expiresAt),
  }),
);

export const conversationsTable = pgTable("conversations", {
  id: text("id").primaryKey(),
  type: conversationTypeEnum("type").notNull(),
  title: text("title"),
  avatarUrl: text("avatar_url"),
  createdBy: text("created_by")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  groupSettings: jsonb("group_settings").$type<{
    membersCanSendMedia?: boolean;
    accessMode?: "closed" | "invite" | "open";
  }>(),
}, (table) => ({
  createdByIdx: index("conversations_created_by_idx").on(table.createdBy),
  updatedAtIdx: index("conversations_updated_at_idx").on(table.updatedAt),
}));

export const groupInvitesTable = pgTable("group_invites", {
  token: text("token").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversationsTable.id, { onDelete: "cascade" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  useCount: integer("use_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  conversationIdx: index("group_invites_conversation_idx").on(table.conversationId),
  expiresAtIdx: index("group_invites_expires_at_idx").on(table.expiresAt),
}));

export const conversationMemberInvitesTable = pgTable(
  "conversation_member_invites",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    invitedUserId: text("invited_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => ({
    invitedUserIdx: index("conversation_member_invites_invited_user_idx").on(table.invitedUserId),
    conversationIdx: index("conversation_member_invites_conversation_idx").on(table.conversationId),
  }),
);

export const conversationMembersTable = pgTable(
  "conversation_members",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    lastReadMessageId: text("last_read_message_id"),
    unreadCount: integer("unread_count").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    mutedAt: timestamp("muted_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.conversationId, table.userId] }),
    conversationIdx: index("conversation_members_conversation_idx").on(table.conversationId),
    userIdx: index("conversation_members_user_idx").on(table.userId),
  }),
);

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderId: text("sender_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  type: messageTypeEnum("type").notNull().default("text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  conversationIdx: index("messages_conversation_idx").on(table.conversationId),
  senderIdx: index("messages_sender_idx").on(table.senderId),
  createdAtIdx: index("messages_created_at_idx").on(table.createdAt),
}));

export const messageReceiptsTable = pgTable(
  "message_receipts",
  {
    messageId: text("message_id")
      .notNull()
      .references(() => messagesTable.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.messageId, table.userId] }),
    conversationIdx: index("message_receipts_conversation_idx").on(table.conversationId),
    userIdx: index("message_receipts_user_idx").on(table.userId),
  }),
);

export const messageReactionsTable = pgTable(
  "message_reactions",
  {
    messageId: text("message_id")
      .notNull()
      .references(() => messagesTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.messageId, table.userId] }),
    messageIdx: index("message_reactions_message_idx").on(table.messageId),
    userIdx: index("message_reactions_user_idx").on(table.userId),
  }),
);

export const deviceTokensTable = pgTable("device_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  pushToken: text("push_token").notNull(),
  voipPushToken: text("voip_push_token"),
  platform: text("platform").notNull(),
  deviceName: text("device_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pushTokenIdx: uniqueIndex("device_tokens_push_token_idx").on(table.pushToken),
  userIdx: index("device_tokens_user_idx").on(table.userId),
}));

export const e2eDevicesTable = pgTable("e2e_devices", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  deviceId: text("device_id").notNull(),
  registrationId: integer("registration_id").notNull(),
  identityKeyPublic: text("identity_key_public").notNull(),
  signedPreKeyId: integer("signed_pre_key_id").notNull(),
  signedPreKeyPublic: text("signed_pre_key_public").notNull(),
  signedPreKeySignature: text("signed_pre_key_signature").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userDeviceIdx: uniqueIndex("e2e_devices_user_device_idx").on(table.userId, table.deviceId),
  userIdx: index("e2e_devices_user_idx").on(table.userId),
}));

export const e2eOneTimePreKeysTable = pgTable("e2e_one_time_prekeys", {
  id: text("id").primaryKey(),
  deviceRowId: text("device_row_id")
    .notNull()
    .references(() => e2eDevicesTable.id, { onDelete: "cascade" }),
  keyId: integer("key_id").notNull(),
  publicKey: text("public_key").notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  deviceKeyIdx: uniqueIndex("e2e_one_time_prekeys_device_key_idx").on(table.deviceRowId, table.keyId),
  deviceIdx: index("e2e_one_time_prekeys_device_idx").on(table.deviceRowId),
}));

export const userBlocksTable = pgTable(
  "user_blocks",
  {
    blockerId: text("blocker_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.blockerId, table.blockedId] }),
    blockerIdx: index("user_blocks_blocker_idx").on(table.blockerId),
    blockedIdx: index("user_blocks_blocked_idx").on(table.blockedId),
  }),
);

export const contactEdgesTable = pgTable(
  "contact_edges",
  {
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    normalizedPhone: text("normalized_phone").notNull(),
    contactName: text("contact_name").notNull(),
    matchedUserId: text("matched_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    /** phonebook = carnet synchronisé ; story_reply = ajouté via réponse à un statut */
    source: text("source").notNull().default("phonebook"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.ownerUserId, table.normalizedPhone] }),
    ownerIdx: index("contact_edges_owner_idx").on(table.ownerUserId),
    matchedIdx: index("contact_edges_matched_user_idx").on(table.matchedUserId),
  }),
);

export const storiesTable = pgTable("stories", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  type: storyTypeEnum("type").notNull().default("text"),
  content: text("content").notNull(),
  backgroundColor: text("background_color").notNull().default("#6D4AFF"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index("stories_user_idx").on(table.userId),
  expiresAtIdx: index("stories_expires_at_idx").on(table.expiresAt),
}));

export const storyViewsTable = pgTable(
  "story_views",
  {
    storyId: text("story_id")
      .notNull()
      .references(() => storiesTable.id, { onDelete: "cascade" }),
    viewerUserId: text("viewer_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.storyId, table.viewerUserId] }),
    viewerIdx: index("story_views_viewer_idx").on(table.viewerUserId),
  }),
);

export const callSessionsTable = pgTable(
  "call_sessions",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    callerUserId: text("caller_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    callerName: text("caller_name").notNull(),
    callerAvatarUrl: text("caller_avatar_url"),
    calleeUserIds: text("callee_user_ids").notNull(),
    status: callSessionStatusEnum("status").notNull().default("ringing"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    callLogCreated: boolean("call_log_created").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    conversationIdx: index("call_sessions_conversation_idx").on(table.conversationId),
    callerIdx: index("call_sessions_caller_idx").on(table.callerUserId),
    statusIdx: index("call_sessions_status_idx").on(table.status),
    createdAtIdx: index("call_sessions_created_at_idx").on(table.createdAt),
  }),
);

export const userRelations = relations(usersTable, ({ many }) => ({
  sessions: many(sessionsTable),
  memberships: many(conversationMembersTable),
  messages: many(messagesTable),
  receipts: many(messageReceiptsTable),
  devices: many(deviceTokensTable),
  stories: many(storiesTable),
}));

export const conversationRelations = relations(conversationsTable, ({ many }) => ({
  members: many(conversationMembersTable),
  messages: many(messagesTable),
  invites: many(groupInvitesTable),
}));

export const groupInviteRelations = relations(groupInvitesTable, ({ one }) => ({
  conversation: one(conversationsTable, {
    fields: [groupInvitesTable.conversationId],
    references: [conversationsTable.id],
  }),
  creator: one(usersTable, {
    fields: [groupInvitesTable.createdBy],
    references: [usersTable.id],
  }),
}));

export const conversationMemberRelations = relations(
  conversationMembersTable,
  ({ one }) => ({
    conversation: one(conversationsTable, {
      fields: [conversationMembersTable.conversationId],
      references: [conversationsTable.id],
    }),
    user: one(usersTable, {
      fields: [conversationMembersTable.userId],
      references: [usersTable.id],
    }),
  }),
);

export const messageRelations = relations(messagesTable, ({ many, one }) => ({
  conversation: one(conversationsTable, {
    fields: [messagesTable.conversationId],
    references: [conversationsTable.id],
  }),
  sender: one(usersTable, {
    fields: [messagesTable.senderId],
    references: [usersTable.id],
  }),
  receipts: many(messageReceiptsTable),
  reactions: many(messageReactionsTable),
}));

export const messageReceiptRelations = relations(messageReceiptsTable, ({ one }) => ({
  message: one(messagesTable, {
    fields: [messageReceiptsTable.messageId],
    references: [messagesTable.id],
  }),
  user: one(usersTable, {
    fields: [messageReceiptsTable.userId],
    references: [usersTable.id],
  }),
}));

export const messageReactionRelations = relations(messageReactionsTable, ({ one }) => ({
  message: one(messagesTable, {
    fields: [messageReactionsTable.messageId],
    references: [messagesTable.id],
  }),
  user: one(usersTable, {
    fields: [messageReactionsTable.userId],
    references: [usersTable.id],
  }),
}));

export const storyRelations = relations(storiesTable, ({ many, one }) => ({
  user: one(usersTable, {
    fields: [storiesTable.userId],
    references: [usersTable.id],
  }),
  views: many(storyViewsTable),
}));

export const storyViewRelations = relations(storyViewsTable, ({ one }) => ({
  story: one(storiesTable, {
    fields: [storyViewsTable.storyId],
    references: [storiesTable.id],
  }),
  viewer: one(usersTable, {
    fields: [storyViewsTable.viewerUserId],
    references: [usersTable.id],
  }),
}));

export type UserRecord = typeof usersTable.$inferSelect;
export type NewUserRecord = typeof usersTable.$inferInsert;
export type ConversationRecord = typeof conversationsTable.$inferSelect;
export type GroupInviteRecord = typeof groupInvitesTable.$inferSelect;
export type ConversationMemberRecord = typeof conversationMembersTable.$inferSelect;
export type UserBlockRecord = typeof userBlocksTable.$inferSelect;
export type MessageRecord = typeof messagesTable.$inferSelect;
export type MessageReceiptRecord = typeof messageReceiptsTable.$inferSelect;
export type StoryRecord = typeof storiesTable.$inferSelect;
export type StoryViewRecord = typeof storyViewsTable.$inferSelect;
export type CallSessionRecord = typeof callSessionsTable.$inferSelect;

export const channelMediaTypeEnum = pgEnum("channel_media_type", ["text", "image", "video"]);
export const channelAdminRoleEnum = pgEnum("channel_admin_role", ["owner", "admin"]);

export const channelsTable = pgTable(
  "channels",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    avatarUrl: text("avatar_url"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    category: text("category"),
    isVerified: boolean("is_verified").notNull().default(false),
    isPublic: boolean("is_public").notNull().default(true),
    followersCount: integer("followers_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index("channels_owner_idx").on(table.ownerId),
    nameIdx: index("channels_name_idx").on(table.name),
    categoryIdx: index("channels_category_idx").on(table.category),
    createdAtIdx: index("channels_created_at_idx").on(table.createdAt),
    followersCountIdx: index("channels_followers_count_idx").on(table.followersCount),
  }),
);

export const channelAdminsTable = pgTable(
  "channel_admins",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => channelsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: channelAdminRoleEnum("role").notNull().default("admin"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.channelId, table.userId] }),
    userIdx: index("channel_admins_user_idx").on(table.userId),
  }),
);

export const channelFollowersTable = pgTable(
  "channel_followers",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => channelsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    followedAt: timestamp("followed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.channelId, table.userId] }),
    userIdx: index("channel_followers_user_idx").on(table.userId),
    followedAtIdx: index("channel_followers_followed_at_idx").on(table.followedAt),
  }),
);

export const channelPostsTable = pgTable(
  "channel_posts",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channelsTable.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    mediaUrl: text("media_url"),
    mediaType: channelMediaTypeEnum("media_type").notNull().default("text"),
    viewsCount: integer("views_count").notNull().default(0),
    reactionsCount: integer("reactions_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    channelCreatedIdx: index("channel_posts_channel_created_idx").on(table.channelId, table.createdAt),
    authorIdx: index("channel_posts_author_idx").on(table.authorId),
    createdAtIdx: index("channel_posts_created_at_idx").on(table.createdAt),
  }),
);

export const channelReactionsTable = pgTable(
  "channel_reactions",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => channelPostsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    postUserIdx: uniqueIndex("channel_reactions_post_user_idx").on(table.postId, table.userId),
    postIdx: index("channel_reactions_post_idx").on(table.postId),
    userIdx: index("channel_reactions_user_idx").on(table.userId),
  }),
);

export const channelPostViewsTable = pgTable(
  "channel_post_views",
  {
    postId: text("post_id")
      .notNull()
      .references(() => channelPostsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.userId] }),
    postIdx: index("channel_post_views_post_idx").on(table.postId),
    userIdx: index("channel_post_views_user_idx").on(table.userId),
  }),
);

export const channelReportsTable = pgTable(
  "channel_reports",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channelsTable.id, { onDelete: "cascade" }),
    reporterUserId: text("reporter_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    reason: text("reason").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    channelReporterIdx: uniqueIndex("channel_reports_channel_reporter_idx").on(
      table.channelId,
      table.reporterUserId,
    ),
    channelIdx: index("channel_reports_channel_idx").on(table.channelId),
    reporterIdx: index("channel_reports_reporter_idx").on(table.reporterUserId),
    createdAtIdx: index("channel_reports_created_at_idx").on(table.createdAt),
  }),
);

export const channelRelations = relations(channelsTable, ({ many, one }) => ({
  owner: one(usersTable, {
    fields: [channelsTable.ownerId],
    references: [usersTable.id],
  }),
  admins: many(channelAdminsTable),
  followers: many(channelFollowersTable),
  posts: many(channelPostsTable),
  reports: many(channelReportsTable),
}));

export type ChannelRecord = typeof channelsTable.$inferSelect;
export type ChannelPostRecord = typeof channelPostsTable.$inferSelect;
export type ChannelReportRecord = typeof channelReportsTable.$inferSelect;
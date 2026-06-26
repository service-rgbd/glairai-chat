import { randomUUID } from "node:crypto";

import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";

import {
  channelAdminsTable,
  channelFollowersTable,
  channelPostViewsTable,
  channelPostsTable,
  channelReactionsTable,
  channelReportsTable,
  channelsTable,
  db,
  hasDatabase,
  usersTable,
} from "@workspace/db";

import { chatService } from "./chat-service";
import { notifyChannelSubscribersOfNewPost } from "./channel-notifications";
import { publishChannelEvent, type ChannelRealtimePost } from "./channel-realtime";
import { formatFollowersCount } from "./channel-utils";

export { formatFollowersCount };

export type ChannelMediaType = "text" | "image" | "video";
export type ChannelRole = "owner" | "admin" | "follower" | "visitor";

export type ChannelDto = {
  id: string;
  name: string;
  description: string;
  avatarUrl: string | null;
  ownerId: string;
  category: string | null;
  isVerified: boolean;
  isPublic: boolean;
  followersCount: number;
  createdAt: string;
  updatedAt: string;
  isFollowing: boolean;
  role: ChannelRole;
};

export type ChannelPostDto = {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  mediaUrl: string | null;
  mediaType: ChannelMediaType;
  viewsCount: number;
  reactionsCount: number;
  createdAt: string;
  userReaction: string | null;
  channel?: Pick<ChannelDto, "id" | "name" | "avatarUrl" | "isVerified">;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function randomId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

function toIso(value: Date) {
  return value.toISOString();
}

function clampPageSize(limit?: number) {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(1, Math.floor(limit)), MAX_PAGE_SIZE);
}

class ChannelService {
  private ensureDb() {
    if (!hasDatabase || !db) {
      throw new Error("DATABASE_URL est requis pour le module Chaînes");
    }
    return db;
  }

  private async requireUserId(token: string) {
    return chatService.resolveUserIdByToken(token);
  }

  private mapChannel(
    row: typeof channelsTable.$inferSelect,
    options: { isFollowing: boolean; role: ChannelRole },
  ): ChannelDto {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      avatarUrl: row.avatarUrl,
      ownerId: row.ownerId,
      category: row.category,
      isVerified: row.isVerified,
      isPublic: row.isPublic,
      followersCount: row.followersCount,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
      isFollowing: options.isFollowing,
      role: options.role,
    };
  }

  private mapPost(
    row: typeof channelPostsTable.$inferSelect,
    userReaction: string | null,
    channel?: Pick<ChannelDto, "id" | "name" | "avatarUrl" | "isVerified">,
  ): ChannelPostDto {
    return {
      id: row.id,
      channelId: row.channelId,
      authorId: row.authorId,
      content: row.content,
      mediaUrl: row.mediaUrl,
      mediaType: row.mediaType,
      viewsCount: row.viewsCount,
      reactionsCount: row.reactionsCount,
      createdAt: toIso(row.createdAt),
      userReaction,
      channel,
    };
  }

  private async resolveRole(channelId: string, userId: string): Promise<ChannelRole> {
    const database = this.ensureDb();
    const [channel] = await database
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, channelId))
      .limit(1);
    if (!channel) throw new Error("Chaîne introuvable");

    if (channel.ownerId === userId) return "owner";

    const [admin] = await database
      .select()
      .from(channelAdminsTable)
      .where(and(eq(channelAdminsTable.channelId, channelId), eq(channelAdminsTable.userId, userId)))
      .limit(1);
    if (admin) return admin.role;

    const [follower] = await database
      .select()
      .from(channelFollowersTable)
      .where(
        and(eq(channelFollowersTable.channelId, channelId), eq(channelFollowersTable.userId, userId)),
      )
      .limit(1);
    if (follower) return "follower";

    return "visitor";
  }

  private async requireChannel(channelId: string) {
    const database = this.ensureDb();
    const [channel] = await database
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, channelId))
      .limit(1);
    if (!channel) throw new Error("Chaîne introuvable");
    return channel;
  }

  private async requireCanPublish(channelId: string, userId: string) {
    const role = await this.resolveRole(channelId, userId);
    if (role !== "owner" && role !== "admin") {
      throw new Error("Seuls les administrateurs peuvent publier sur cette chaîne");
    }
  }

  private async requireCanManage(channelId: string, userId: string) {
    const role = await this.resolveRole(channelId, userId);
    if (role !== "owner") {
      throw new Error("Seul le propriétaire peut gérer cette chaîne");
    }
  }

  private async getFollowerIds(channelId: string) {
    const database = this.ensureDb();
    const rows = await database
      .select({ userId: channelFollowersTable.userId })
      .from(channelFollowersTable)
      .where(eq(channelFollowersTable.channelId, channelId));
    return rows.map((row) => row.userId);
  }

  async createChannel(
    token: string,
    input: {
      name: string;
      description?: string;
      avatarUrl?: string;
      category?: string;
      isPublic?: boolean;
    },
  ) {
    const userId = await this.requireUserId(token);
    const database = this.ensureDb();
    const name = input.name.trim();
    if (name.length < 2) throw new Error("Le nom de la chaîne est trop court");

    const channelId = randomId("chn");
    const now = new Date();

    await database.insert(channelsTable).values({
      id: channelId,
      name,
      description: input.description?.trim() ?? "",
      avatarUrl: input.avatarUrl ?? null,
      ownerId: userId,
      category: input.category?.trim() || null,
      isPublic: input.isPublic ?? true,
      createdAt: now,
      updatedAt: now,
    });

    await database.insert(channelAdminsTable).values({
      channelId,
      userId,
      role: "owner",
    });

    const [channel] = await database
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, channelId))
      .limit(1);

    return {
      channel: this.mapChannel(channel!, { isFollowing: false, role: "owner" }),
    };
  }

  async listChannels(
    token: string,
    options?: { search?: string; category?: string; cursor?: string; limit?: number },
  ) {
    const userId = await this.requireUserId(token);
    const database = this.ensureDb();
    const limit = clampPageSize(options?.limit);
    const search = options?.search?.trim();

    const conditions = [eq(channelsTable.isPublic, true)];
    if (search) {
      conditions.push(
        or(ilike(channelsTable.name, `%${search}%`), ilike(channelsTable.description, `%${search}%`))!,
      );
    }
    if (options?.category) {
      conditions.push(eq(channelsTable.category, options.category));
    }

    const rows = await database
      .select()
      .from(channelsTable)
      .where(and(...conditions))
      .orderBy(desc(channelsTable.followersCount), desc(channelsTable.createdAt))
      .limit(limit + 1);

    const channelIds = rows.slice(0, limit).map((row) => row.id);
    const following = channelIds.length
      ? await database
          .select({ channelId: channelFollowersTable.channelId })
          .from(channelFollowersTable)
          .where(
            and(
              eq(channelFollowersTable.userId, userId),
              inArray(channelFollowersTable.channelId, channelIds),
            ),
          )
      : [];
    const followingSet = new Set(following.map((row) => row.channelId));

    const channels = rows.slice(0, limit).map((row) =>
      this.mapChannel(row, {
        isFollowing: followingSet.has(row.id),
        role: row.ownerId === userId ? "owner" : followingSet.has(row.id) ? "follower" : "visitor",
      }),
    );

    return {
      channels,
      nextCursor: rows.length > limit ? channels[channels.length - 1]?.id ?? null : null,
    };
  }

  async getChannel(token: string, channelId: string) {
    const userId = await this.requireUserId(token);
    const channel = await this.requireChannel(channelId);
    if (!channel.isPublic) {
      const role = await this.resolveRole(channelId, userId);
      if (role === "visitor") throw new Error("Chaîne introuvable");
    }

    const database = this.ensureDb();
    const [follower] = await database
      .select()
      .from(channelFollowersTable)
      .where(
        and(eq(channelFollowersTable.channelId, channelId), eq(channelFollowersTable.userId, userId)),
      )
      .limit(1);

    const role = await this.resolveRole(channelId, userId);
    return {
      channel: this.mapChannel(channel, { isFollowing: Boolean(follower), role }),
    };
  }

  async updateChannel(
    token: string,
    channelId: string,
    input: {
      name?: string;
      description?: string;
      avatarUrl?: string | null;
      category?: string | null;
      isPublic?: boolean;
    },
  ) {
    const userId = await this.requireUserId(token);
    await this.requireCanManage(channelId, userId);
    const database = this.ensureDb();

    const patch: Partial<typeof channelsTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (typeof input.name === "string") {
      const name = input.name.trim();
      if (name.length < 2) throw new Error("Le nom de la chaîne est trop court");
      patch.name = name;
    }
    if (typeof input.description === "string") patch.description = input.description.trim();
    if (input.avatarUrl !== undefined) patch.avatarUrl = input.avatarUrl;
    if (input.category !== undefined) patch.category = input.category?.trim() || null;
    if (typeof input.isPublic === "boolean") patch.isPublic = input.isPublic;

    await database.update(channelsTable).set(patch).where(eq(channelsTable.id, channelId));

    publishChannelEvent({
      type: "channel.updated",
      channelId,
      participantIds: await this.getFollowerIds(channelId),
    });

    return this.getChannel(token, channelId);
  }

  async deleteChannel(token: string, channelId: string) {
    const userId = await this.requireUserId(token);
    await this.requireCanManage(channelId, userId);
    const database = this.ensureDb();
    await database.delete(channelsTable).where(eq(channelsTable.id, channelId));
    return { success: true };
  }

  async followChannel(token: string, channelId: string) {
    const userId = await this.requireUserId(token);
    await this.requireChannel(channelId);
    const database = this.ensureDb();

    const inserted = await database
      .insert(channelFollowersTable)
      .values({ channelId, userId })
      .onConflictDoNothing()
      .returning();

    if (inserted.length) {
      await database
        .update(channelsTable)
        .set({
          followersCount: sql`${channelsTable.followersCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(channelsTable.id, channelId));
    }

    return this.getChannel(token, channelId);
  }

  async unfollowChannel(token: string, channelId: string) {
    const userId = await this.requireUserId(token);
    const database = this.ensureDb();

    const deleted = await database
      .delete(channelFollowersTable)
      .where(
        and(eq(channelFollowersTable.channelId, channelId), eq(channelFollowersTable.userId, userId)),
      )
      .returning();

    if (deleted.length) {
      await database
        .update(channelsTable)
        .set({
          followersCount: sql`GREATEST(${channelsTable.followersCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(channelsTable.id, channelId));
    }

    return this.getChannel(token, channelId);
  }

  async createPost(
    token: string,
    channelId: string,
    input: {
      content?: string;
      mediaUrl?: string;
      mediaType?: ChannelMediaType;
    },
  ) {
    const userId = await this.requireUserId(token);
    await this.requireCanPublish(channelId, userId);
    const channel = await this.requireChannel(channelId);
    const database = this.ensureDb();

    const mediaType = input.mediaType ?? "text";
    const content = input.content?.trim() ?? "";
    if (mediaType === "text" && !content) {
      throw new Error("Le contenu de la publication est requis");
    }
    if ((mediaType === "image" || mediaType === "video") && !input.mediaUrl) {
      throw new Error("Le média est requis pour ce type de publication");
    }

    const postId = randomId("chp");
    const now = new Date();
    await database.insert(channelPostsTable).values({
      id: postId,
      channelId,
      authorId: userId,
      content,
      mediaUrl: input.mediaUrl ?? null,
      mediaType,
      createdAt: now,
    });

    const [post] = await database
      .select()
      .from(channelPostsTable)
      .where(eq(channelPostsTable.id, postId))
      .limit(1);

    const dto = this.mapPost(post!, null, {
      id: channel.id,
      name: channel.name,
      avatarUrl: channel.avatarUrl,
      isVerified: channel.isVerified,
    });

    const followerIds = await this.getFollowerIds(channelId);
    const realtimePost: ChannelRealtimePost = {
      id: dto.id,
      channelId: dto.channelId,
      authorId: dto.authorId,
      content: dto.content,
      mediaUrl: dto.mediaUrl,
      mediaType: dto.mediaType,
      viewsCount: dto.viewsCount,
      reactionsCount: dto.reactionsCount,
      createdAt: dto.createdAt,
    };

    publishChannelEvent({
      type: "channel.post.created",
      channelId,
      participantIds: followerIds,
      post: realtimePost,
    });

    const preview =
      mediaType === "text"
        ? content
        : mediaType === "image"
          ? "📷 Photo"
          : "🎬 Vidéo";

    void notifyChannelSubscribersOfNewPost({
      channelId,
      channelName: channel.name,
      postPreview: preview,
      excludeUserId: userId,
    });

    return { post: dto };
  }

  async listChannelPosts(
    token: string,
    channelId: string,
    options?: { cursor?: string; limit?: number },
  ) {
    const userId = await this.requireUserId(token);
    const channel = await this.requireChannel(channelId);
    if (!channel.isPublic) {
      const role = await this.resolveRole(channelId, userId);
      if (role === "visitor") throw new Error("Chaîne introuvable");
    }

    const database = this.ensureDb();
    const limit = clampPageSize(options?.limit);

    let cursorDate: Date | null = null;
    if (options?.cursor) {
      const [cursorPost] = await database
        .select()
        .from(channelPostsTable)
        .where(eq(channelPostsTable.id, options.cursor))
        .limit(1);
      cursorDate = cursorPost?.createdAt ?? null;
    }

    const rows = await database
      .select()
      .from(channelPostsTable)
      .where(
        and(
          eq(channelPostsTable.channelId, channelId),
          cursorDate ? sql`${channelPostsTable.createdAt} < ${cursorDate}` : undefined,
        ),
      )
      .orderBy(desc(channelPostsTable.createdAt))
      .limit(limit + 1);

    const postIds = rows.slice(0, limit).map((row) => row.id);
    const reactions = postIds.length
      ? await database
          .select()
          .from(channelReactionsTable)
          .where(
            and(
              eq(channelReactionsTable.userId, userId),
              inArray(channelReactionsTable.postId, postIds),
            ),
          )
      : [];
    const reactionByPost = new Map(reactions.map((row) => [row.postId, row.emoji]));

    const posts = rows.slice(0, limit).map((row) =>
      this.mapPost(row, reactionByPost.get(row.id) ?? null),
    );

    return {
      posts,
      nextCursor: rows.length > limit ? posts[posts.length - 1]?.id ?? null : null,
    };
  }

  async getFeed(token: string, options?: { cursor?: string; limit?: number }) {
    const userId = await this.requireUserId(token);
    const database = this.ensureDb();
    const limit = clampPageSize(options?.limit);

    const followed = await database
      .select({ channelId: channelFollowersTable.channelId })
      .from(channelFollowersTable)
      .where(eq(channelFollowersTable.userId, userId));

    const channelIds = followed.map((row) => row.channelId);
    if (!channelIds.length) {
      return { posts: [], nextCursor: null };
    }

    let cursorDate: Date | null = null;
    if (options?.cursor) {
      const [cursorPost] = await database
        .select()
        .from(channelPostsTable)
        .where(eq(channelPostsTable.id, options.cursor))
        .limit(1);
      cursorDate = cursorPost?.createdAt ?? null;
    }

    const rows = await database
      .select({
        post: channelPostsTable,
        channel: channelsTable,
      })
      .from(channelPostsTable)
      .innerJoin(channelsTable, eq(channelsTable.id, channelPostsTable.channelId))
      .where(
        and(
          inArray(channelPostsTable.channelId, channelIds),
          cursorDate ? sql`${channelPostsTable.createdAt} < ${cursorDate}` : undefined,
        ),
      )
      .orderBy(desc(channelPostsTable.createdAt))
      .limit(limit + 1);

    const postIds = rows.slice(0, limit).map((row) => row.post.id);
    const reactions = postIds.length
      ? await database
          .select()
          .from(channelReactionsTable)
          .where(
            and(
              eq(channelReactionsTable.userId, userId),
              inArray(channelReactionsTable.postId, postIds),
            ),
          )
      : [];
    const reactionByPost = new Map(reactions.map((row) => [row.postId, row.emoji]));

    const posts = rows.slice(0, limit).map((row) =>
      this.mapPost(row.post, reactionByPost.get(row.post.id) ?? null, {
        id: row.channel.id,
        name: row.channel.name,
        avatarUrl: row.channel.avatarUrl,
        isVerified: row.channel.isVerified,
      }),
    );

    return {
      posts,
      nextCursor: rows.length > limit ? posts[posts.length - 1]?.id ?? null : null,
    };
  }

  async addReaction(token: string, postId: string, emoji: string) {
    const userId = await this.requireUserId(token);
    const database = this.ensureDb();
    const normalizedEmoji = emoji.trim();
    if (!normalizedEmoji) throw new Error("Emoji requis");

    const [post] = await database
      .select()
      .from(channelPostsTable)
      .where(eq(channelPostsTable.id, postId))
      .limit(1);
    if (!post) throw new Error("Publication introuvable");

    const role = await this.resolveRole(post.channelId, userId);
    if (role === "visitor") {
      throw new Error("Suivez cette chaîne pour réagir à ses publications");
    }
    const participantIds = await this.getFollowerIds(post.channelId);
    const publishReactionUpdate = (reactionsCount: number) => {
      publishChannelEvent({
        type: "channel.post.reacted",
        channelId: post.channelId,
        postId,
        reactionsCount,
        participantIds,
      });
    };

    const [existing] = await database
      .select()
      .from(channelReactionsTable)
      .where(
        and(eq(channelReactionsTable.postId, postId), eq(channelReactionsTable.userId, userId)),
      )
      .limit(1);

    if (existing) {
      if (existing.emoji === normalizedEmoji) {
        await database.delete(channelReactionsTable).where(eq(channelReactionsTable.id, existing.id));
        await database
          .update(channelPostsTable)
          .set({ reactionsCount: sql`GREATEST(${channelPostsTable.reactionsCount} - 1, 0)` })
          .where(eq(channelPostsTable.id, postId));
        const reactionsCount = Math.max(post.reactionsCount - 1, 0);
        publishReactionUpdate(reactionsCount);
        return { reaction: null, reactionsCount };
      }

      await database
        .update(channelReactionsTable)
        .set({ emoji: normalizedEmoji })
        .where(eq(channelReactionsTable.id, existing.id));
      publishReactionUpdate(post.reactionsCount);
      return { reaction: normalizedEmoji, reactionsCount: post.reactionsCount };
    }

    await database.insert(channelReactionsTable).values({
      id: randomId("chr"),
      postId,
      userId,
      emoji: normalizedEmoji,
    });
    await database
      .update(channelPostsTable)
      .set({ reactionsCount: sql`${channelPostsTable.reactionsCount} + 1` })
      .where(eq(channelPostsTable.id, postId));

    const reactionsCount = post.reactionsCount + 1;
    publishReactionUpdate(reactionsCount);
    return { reaction: normalizedEmoji, reactionsCount };
  }

  async reportChannel(token: string, channelId: string, reason?: string) {
    const userId = await this.requireUserId(token);
    const database = this.ensureDb();
    const channel = await this.requireChannel(channelId);
    const normalizedReason = reason?.trim().slice(0, 500) ?? "";

    if (channel.ownerId === userId) {
      throw new Error("Vous ne pouvez pas signaler votre propre chaîne");
    }

    await database
      .insert(channelReportsTable)
      .values({
        id: randomId("chrp"),
        channelId,
        reporterUserId: userId,
        reason: normalizedReason,
      })
      .onConflictDoUpdate({
        target: [channelReportsTable.channelId, channelReportsTable.reporterUserId],
        set: { reason: normalizedReason, createdAt: new Date() },
      });

    return { success: true };
  }

  async recordView(token: string, postId: string) {
    const userId = await this.requireUserId(token);
    const database = this.ensureDb();

    const [post] = await database
      .select()
      .from(channelPostsTable)
      .where(eq(channelPostsTable.id, postId))
      .limit(1);
    if (!post) throw new Error("Publication introuvable");

    const inserted = await database
      .insert(channelPostViewsTable)
      .values({ postId, userId })
      .onConflictDoNothing()
      .returning();

    if (inserted.length) {
      await database
        .update(channelPostsTable)
        .set({ viewsCount: sql`${channelPostsTable.viewsCount} + 1` })
        .where(eq(channelPostsTable.id, postId));
      return { viewsCount: post.viewsCount + 1, recorded: true };
    }

    return { viewsCount: post.viewsCount, recorded: false };
  }

  async deletePost(token: string, postId: string) {
    const userId = await this.requireUserId(token);
    const database = this.ensureDb();

    const [post] = await database
      .select()
      .from(channelPostsTable)
      .where(eq(channelPostsTable.id, postId))
      .limit(1);
    if (!post) throw new Error("Publication introuvable");

    const role = await this.resolveRole(post.channelId, userId);
    if (role !== "owner" && role !== "admin") {
      throw new Error("Vous ne pouvez pas supprimer cette publication");
    }

    await database.delete(channelPostsTable).where(eq(channelPostsTable.id, postId));

    publishChannelEvent({
      type: "channel.post.deleted",
      channelId: post.channelId,
      postId,
      participantIds: await this.getFollowerIds(post.channelId),
    });

    return { success: true };
  }

  async listDiscoverySections(token: string) {
    const userId = await this.requireUserId(token);
    const database = this.ensureDb();

    const categories = await database
      .selectDistinct({ category: channelsTable.category })
      .from(channelsTable)
      .where(and(eq(channelsTable.isPublic, true), sql`${channelsTable.category} IS NOT NULL`))
      .limit(8);

    const sections: Array<{ title: string; channels: ChannelDto[] }> = [];

    const ownedRows = await database
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.ownerId, userId))
      .orderBy(desc(channelsTable.updatedAt))
      .limit(10);

    if (ownedRows.length) {
      sections.push({
        title: "Mes chaînes",
        channels: ownedRows.map((row) =>
          this.mapChannel(row, { isFollowing: false, role: "owner" }),
        ),
      });
    }

    const popular = await this.listChannels(token, { limit: 6 });
    if (popular.channels.length) {
      sections.push({ title: "Explorer les chaînes", channels: popular.channels });
    }

    for (const row of categories) {
      if (!row.category) continue;
      const result = await this.listChannels(token, { category: row.category, limit: 6 });
      if (result.channels.length) {
        sections.push({ title: row.category, channels: result.channels });
      }
    }

    const followed = await database
      .select({ channelId: channelFollowersTable.channelId })
      .from(channelFollowersTable)
      .where(eq(channelFollowersTable.userId, userId));

    return { sections, followedChannelIds: followed.map((row) => row.channelId) };
  }

  async addAdmin(token: string, channelId: string, adminUserId: string) {
    const userId = await this.requireUserId(token);
    await this.requireCanManage(channelId, userId);
    if (adminUserId === userId) throw new Error("Le propriétaire est déjà administrateur");

    const database = this.ensureDb();
    await database
      .insert(channelAdminsTable)
      .values({ channelId, userId: adminUserId, role: "admin" })
      .onConflictDoNothing();

    return { success: true };
  }
}

export const channelService = new ChannelService();

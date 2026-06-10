import { customFetch } from "@workspace/api-client-react";

import type { Channel, ChannelDiscoverySection, ChannelPost } from "./types";

export async function fetchChannelDiscovery() {
  return customFetch<{
    sections: ChannelDiscoverySection[];
    followedChannelIds: string[];
  }>("/api/channels/discovery");
}

export async function fetchChannels(params?: {
  search?: string;
  category?: string;
  cursor?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.category) query.set("category", params.category);
  if (params?.cursor) query.set("cursor", params.cursor);
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return customFetch<{ channels: Channel[]; nextCursor: string | null }>(`/api/channels${suffix}`);
}

export async function fetchChannelFeed(cursor?: string) {
  const suffix = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return customFetch<{ posts: ChannelPost[]; nextCursor: string | null }>(`/api/channels/feed${suffix}`);
}

export async function fetchChannel(channelId: string) {
  return customFetch<{ channel: Channel }>(`/api/channels/${channelId}`);
}

export async function fetchChannelPosts(channelId: string, cursor?: string) {
  const suffix = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return customFetch<{ posts: ChannelPost[]; nextCursor: string | null }>(
    `/api/channels/${channelId}/posts${suffix}`,
  );
}

export async function createChannel(input: {
  name: string;
  description?: string;
  avatarUrl?: string;
  category?: string;
}) {
  return customFetch<{ channel: Channel }>("/api/channels", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateChannel(
  channelId: string,
  input: Partial<Pick<Channel, "name" | "description" | "avatarUrl" | "category" | "isPublic">>,
) {
  return customFetch<{ channel: Channel }>(`/api/channels/${channelId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteChannel(channelId: string) {
  return customFetch<{ success: boolean }>(`/api/channels/${channelId}`, { method: "DELETE" });
}

export async function followChannel(channelId: string) {
  return customFetch<{ channel: Channel }>(`/api/channels/${channelId}/follow`, { method: "POST" });
}

export async function unfollowChannel(channelId: string) {
  return customFetch<{ channel: Channel }>(`/api/channels/${channelId}/follow`, { method: "DELETE" });
}

export async function createChannelPost(
  channelId: string,
  input: { content?: string; mediaUrl?: string; mediaType?: ChannelPost["mediaType"] },
) {
  return customFetch<{ post: ChannelPost }>(`/api/channels/${channelId}/posts`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function reactToChannelPost(postId: string, emoji: string) {
  return customFetch<{ reaction: string | null; reactionsCount: number }>(`/api/posts/${postId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
}

export async function recordChannelPostView(postId: string) {
  return customFetch<{ viewsCount: number; recorded: boolean }>(`/api/posts/${postId}/views`, {
    method: "POST",
  });
}

export async function deleteChannelPost(postId: string) {
  return customFetch<{ success: boolean }>(`/api/posts/${postId}`, { method: "DELETE" });
}

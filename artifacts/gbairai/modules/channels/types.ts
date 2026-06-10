export type ChannelMediaType = "text" | "image" | "video";
export type ChannelRole = "owner" | "admin" | "follower" | "visitor";

export type Channel = {
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

export type ChannelPost = {
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
  channel?: Pick<Channel, "id" | "name" | "avatarUrl" | "isVerified">;
};

export type ChannelDiscoverySection = {
  title: string;
  channels: Channel[];
};

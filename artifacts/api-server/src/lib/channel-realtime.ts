import type { Server, Socket } from "socket.io";

export type ChannelRealtimeEvent =
  | {
      type: "channel.post.created";
      participantIds: string[];
      channelId: string;
      post: ChannelRealtimePost;
    }
  | {
      type: "channel.post.deleted";
      participantIds: string[];
      channelId: string;
      postId: string;
    }
  | {
      type: "channel.updated";
      participantIds: string[];
      channelId: string;
    };

export type ChannelRealtimePost = {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  mediaUrl: string | null;
  mediaType: "text" | "image" | "video";
  viewsCount: number;
  reactionsCount: number;
  createdAt: string;
};

type ChannelEventPublisher = (event: ChannelRealtimeEvent) => void;

let eventPublisher: ChannelEventPublisher | null = null;

export function setChannelEventPublisher(publisher: ChannelEventPublisher | null) {
  eventPublisher = publisher;
}

export function publishChannelEvent(event: ChannelRealtimeEvent) {
  eventPublisher?.(event);
}

export function wireChannelEventPublisher(io: Server) {
  setChannelEventPublisher((event) => {
    for (const userId of event.participantIds) {
      io.to(`user:${userId}`).emit(event.type, event);
    }
    if (event.type === "channel.post.created") {
      io.to(`channel:${event.channelId}`).emit(event.type, event);
    }
  });
}

export function registerChannelSocketHandlers(socket: Socket) {
  socket.on("channels:join", (payload?: { channelId?: string }) => {
    if (!payload?.channelId) return;
    socket.join(`channel:${payload.channelId}`);
  });

  socket.on("channels:leave", (payload?: { channelId?: string }) => {
    if (!payload?.channelId) return;
    socket.leave(`channel:${payload.channelId}`);
  });
}

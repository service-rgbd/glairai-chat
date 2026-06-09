import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

import { chatService, type RealtimeEvent } from "./chat-service";
import { logger } from "./logger";

export function attachRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  chatService.setEventPublisher((event: RealtimeEvent) => {
    for (const participantId of event.participantIds) {
      io.to(`user:${participantId}`).emit(event.type, event);
    }
  });

  io.use((socket, next) => {
    void (async () => {
      try {
      const rawToken =
        typeof socket.handshake.auth["token"] === "string"
          ? socket.handshake.auth["token"]
          : typeof socket.handshake.headers.authorization === "string"
            ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, "")
            : null;

      if (!rawToken) {
        next(new Error("Authentication required"));
        return;
      }

      const userId = await chatService.resolveUserIdByToken(rawToken);
      socket.data["token"] = rawToken;
      socket.data["userId"] = userId;
      next();
      } catch (error) {
        next(error instanceof Error ? error : new Error("Invalid session"));
      }
    })();
  });

  io.on("connection", (socket) => {
    const token = socket.data["token"] as string;
    const userId = socket.data["userId"] as string;
    socket.join(`user:${userId}`);

    socket.on("presence:heartbeat", (payload?: { isOnline?: boolean }) => {
      void Promise.resolve(
        chatService.updatePresenceHeartbeat(token, payload?.isOnline ?? true),
      ).catch((error: unknown) => {
          logger.warn({ err: error }, "Failed to process presence heartbeat");
        });
    });

    socket.on(
      "messages:delivered",
      (payload?: { messageId?: string }) => {
        if (!payload?.messageId) return;
        void Promise.resolve(chatService.markMessageDelivered(token, payload.messageId)).catch(
          (error: unknown) => {
            logger.warn({ err: error }, "Failed to process delivery receipt");
          },
        );
      },
    );

    socket.on(
      "messages:read",
      (payload?: { conversationId?: string; messageId?: string }) => {
        if (!payload?.conversationId || !payload.messageId) return;
        void Promise.resolve(
          chatService.markConversationRead(token, payload.conversationId, {
            messageId: payload.messageId,
          }),
        ).catch((error: unknown) => {
            logger.warn({ err: error }, "Failed to process read receipt");
          });
      },
    );

    socket.on(
      "conversation:join",
      async (payload?: { conversationId?: string }) => {
        if (!payload?.conversationId) return;
        try {
          await chatService.getConversation(token, payload.conversationId);
          socket.join(`conversation:${payload.conversationId}`);
        } catch (error) {
          logger.warn({ err: error }, "Failed to join conversation room");
        }
      },
    );

    socket.on(
      "conversation:leave",
      (payload?: { conversationId?: string }) => {
        if (!payload?.conversationId) return;
        socket.leave(`conversation:${payload.conversationId}`);
      },
    );

    socket.on(
      "typing:update",
      (payload?: {
        conversationId?: string;
        isTyping?: boolean;
        participantUserIds?: string[];
      }) => {
        if (!payload?.conversationId) return;
        const typingPayload = {
          conversationId: payload.conversationId,
          userId,
          isTyping: payload.isTyping ?? false,
        };

        if (
          Array.isArray(payload.participantUserIds) &&
          payload.participantUserIds.includes(userId) &&
          payload.participantUserIds.length <= 100
        ) {
          for (const participantId of new Set(payload.participantUserIds)) {
            if (participantId !== userId) {
              io.to(`user:${participantId}`).emit("typing.updated", typingPayload);
            }
          }
          return;
        }

        void Promise.resolve(chatService.getConversation(token, payload.conversationId))
          .then((conversation) => {
            for (const participant of conversation.participants) {
              if (participant.userId !== userId) {
                io.to(`user:${participant.userId}`).emit("typing.updated", typingPayload);
              }
            }
          })
          .catch((error: unknown) => {
            logger.warn({ err: error }, "Failed to broadcast typing update");
          });
      },
    );

    socket.on("disconnect", () => {
      void Promise.resolve(chatService.updatePresenceHeartbeat(token, false)).catch((error: unknown) => {
        logger.warn({ err: error }, "Failed to set user offline on disconnect");
      });
    });
  });

  return io;
}


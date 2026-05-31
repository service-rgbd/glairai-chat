import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

import { chatService } from "./chat-service";

export type CallType = "audio" | "video";

const livekitUrl = process.env["LIVEKIT_URL"]?.trim() ?? "";
const livekitApiKey = process.env["LIVEKIT_API_KEY"]?.trim() ?? "";
const livekitApiSecret = process.env["LIVEKIT_API_SECRET"]?.trim() ?? "";

function requireLiveKitConfig() {
  if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
    throw new Error("Configuration LiveKit manquante");
  }
}

function httpUrlFromWs(url: string) {
  if (url.startsWith("wss://")) return `https://${url.slice("wss://".length)}`;
  if (url.startsWith("ws://")) return `http://${url.slice("ws://".length)}`;
  return url;
}

export async function createCallSession(
  authToken: string,
  input: { conversationId: string; type: CallType },
) {
  requireLiveKitConfig();

  const currentUser = await chatService.getCurrentUser(authToken);
  const conversation = await chatService.getConversation(authToken, input.conversationId);
  const roomName = `conv_${conversation.id}`;

  const roomClient = new RoomServiceClient(
    httpUrlFromWs(livekitUrl),
    livekitApiKey,
    livekitApiSecret,
  );

  try {
    await roomClient.createRoom({
      name: roomName,
      emptyTimeout: 60 * 5,
      maxParticipants: Math.max(conversation.participants.length, 2),
    });
  } catch {
    // Room may already exist; that's fine for retries/rejoins.
  }

  const accessToken = new AccessToken(livekitApiKey, livekitApiSecret, {
    identity: currentUser.id,
    name: currentUser.name,
  });

  accessToken.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const session = {
    conversationId: conversation.id,
    roomName,
    token: await accessToken.toJwt(),
    url: livekitUrl,
    type: input.type,
  };

  await chatService.notifyIncomingCall(authToken, {
    conversationId: conversation.id,
    type: input.type,
    callerUserId: currentUser.id,
    callerName: currentUser.name,
  });

  return session;
}

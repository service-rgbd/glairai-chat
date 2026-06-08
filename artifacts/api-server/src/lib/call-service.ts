import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

import { chatService } from "./chat-service";
import {
  createCallSession as storeCreateCallSession,
  finalizeCall,
  findActiveCallByConversation,
  findRingingCallForCallee,
  getCallSession,
  markCallAnswered,
  scheduleRingTimeout,
} from "./call-session-store";

export type CallType = "audio" | "video";
export type CallRole = "caller" | "callee";

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

async function buildLiveKitSession(
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

  return {
    conversationId: conversation.id,
    roomName,
    token: await accessToken.toJwt(),
    url: livekitUrl,
    type: input.type,
    participantIds: conversation.participants.map((participant) => participant.userId),
  };
}

export async function createCallSession(
  authToken: string,
  input: { conversationId: string; type: CallType; role?: CallRole; callId?: string },
) {
  const role = input.role ?? "caller";
  const livekit = await buildLiveKitSession(authToken, input);
  const currentUser = await chatService.getCurrentUser(authToken);

  if (role === "callee") {
    const activeCall = input.callId
      ? getCallSession(input.callId)
      : findActiveCallByConversation(input.conversationId);

    if (!activeCall || activeCall.status !== "ringing") {
      throw new Error("Aucun appel entrant actif pour cette conversation");
    }

    if (!activeCall.calleeUserIds.includes(currentUser.id)) {
      throw new Error("Appel non autorisé");
    }

    markCallAnswered(activeCall.id);
    await chatService.publishCallAnswered(authToken, {
      callId: activeCall.id,
      conversationId: activeCall.conversationId,
      calleeUserId: currentUser.id,
    });

    return {
      ...livekit,
      callId: activeCall.id,
      role: "callee" as const,
    };
  }

  const calleeUserIds = livekit.participantIds.filter((id) => id !== currentUser.id);
  const activeCall = storeCreateCallSession({
    conversationId: livekit.conversationId,
    type: input.type,
    callerUserId: currentUser.id,
    callerName: currentUser.name,
    calleeUserIds,
  });

  await chatService.notifyIncomingCall(authToken, {
    conversationId: livekit.conversationId,
    type: input.type,
    callerUserId: currentUser.id,
    callerName: currentUser.name,
    callId: activeCall.id,
  });

  scheduleRingTimeout(activeCall.id, () => {
    void chatService.publishCallMissed(activeCall.id);
  });

  return {
    conversationId: livekit.conversationId,
    roomName: livekit.roomName,
    token: livekit.token,
    url: livekit.url,
    type: livekit.type,
    callId: activeCall.id,
    role: "caller" as const,
  };
}

export async function signalCall(
  authToken: string,
  input: { callId: string; action: "cancel" | "decline" | "end" },
) {
  const currentUser = await chatService.getCurrentUser(authToken);
  const session = getCallSession(input.callId);
  if (!session) {
    throw new Error("Appel introuvable");
  }

  const isCaller = currentUser.id === session.callerUserId;
  const isCallee = session.calleeUserIds.includes(currentUser.id);
  if (!isCaller && !isCallee) {
    throw new Error("Appel non autorisé");
  }

  if (input.action === "cancel") {
    if (!isCaller) throw new Error("Seul l'appelant peut annuler l'appel");
    if (session.status !== "ringing") throw new Error("Cet appel n'est plus en cours de sonnerie");
    finalizeCall(session.id, "cancelled");
    await chatService.publishCallCancelled(authToken, session);
    return { ok: true as const, status: "cancelled" as const };
  }

  if (input.action === "decline") {
    if (!isCallee) throw new Error("Seul l'appelé peut refuser l'appel");
    if (session.status !== "ringing") throw new Error("Cet appel n'est plus en cours de sonnerie");
    finalizeCall(session.id, "declined");
    await chatService.publishCallDeclined(authToken, session);
    return { ok: true as const, status: "declined" as const };
  }

  finalizeCall(session.id, "ended");
  await chatService.publishCallEnded(authToken, session);
  return { ok: true as const, status: "ended" as const };
}

export async function getIncomingCallForUser(authToken: string) {
  const currentUser = await chatService.getCurrentUser(authToken);
  const session = findRingingCallForCallee(currentUser.id);
  if (!session) {
    return null;
  }

  return {
    callId: session.id,
    conversationId: session.conversationId,
    callerUserId: session.callerUserId,
    callerName: session.callerName,
    callType: session.type,
  };
}

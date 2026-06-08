import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

import { chatService } from "./chat-service";
import { CallBusyError, CallForbiddenError, CallNotFoundError } from "./call-errors";
import { findRingingCallForCalleeFromDb, isUserBusyInDb } from "./call-session-persistence";
import {
  createCallSession as storeCreateCallSession,
  finalizeCall,
  findActiveCallByConversation,
  findRingingCallForCallee,
  getCallSession,
  hydrateCallSession,
  isUserBusy,
  markCallAnswered,
  resolveCallSession,
  scheduleRingTimeout,
} from "./call-session-store";

export type CallType = "audio" | "video";
export type CallRole = "caller" | "callee";

const LIVEKIT_TOKEN_TTL_SECONDS = 10 * 60;

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
  input: { conversationId: string; type: CallType; callId: string },
) {
  requireLiveKitConfig();

  const currentUser = await chatService.getCurrentUser(authToken);
  const conversation = await chatService.getConversation(authToken, input.conversationId);
  const roomName = `call_${input.callId}`;

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
    ttl: LIVEKIT_TOKEN_TTL_SECONDS,
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

async function assertDirectCallsAllowed(callerUserId: string, calleeUserIds: string[]) {
  for (const calleeId of calleeUserIds) {
    try {
      await chatService.assertDirectCallAllowed(callerUserId, calleeId);
    } catch {
      throw new CallForbiddenError("Appel impossible avec ce contact");
    }
  }
}

async function assertUsersAvailable(callerUserId: string, calleeUserIds: string[]) {
  if (isUserBusy(callerUserId) || (await isUserBusyInDb(callerUserId))) {
    throw new CallBusyError("Vous êtes déjà en communication");
  }

  for (const calleeId of calleeUserIds) {
    if (isUserBusy(calleeId) || (await isUserBusyInDb(calleeId))) {
      throw new CallBusyError("Le destinataire est occupé");
    }
  }
}

function assertCallParticipant(
  session: { callerUserId: string; calleeUserIds: string[] },
  userId: string,
) {
  if (session.callerUserId !== userId && !session.calleeUserIds.includes(userId)) {
    throw new CallForbiddenError("Appel non autorisé");
  }
}

export async function createCallSession(
  authToken: string,
  input: { conversationId: string; type: CallType; role?: CallRole; callId?: string },
) {
  const role = input.role ?? "caller";
  const currentUser = await chatService.getCurrentUser(authToken);

  if (role === "callee") {
    const activeCall =
      (input.callId ? await resolveCallSession(input.callId) : null) ??
      findActiveCallByConversation(input.conversationId);

    if (!activeCall || activeCall.status !== "ringing") {
      throw new CallNotFoundError("Aucun appel entrant actif pour cette conversation");
    }

    if (!activeCall.calleeUserIds.includes(currentUser.id)) {
      throw new CallForbiddenError("Appel non autorisé");
    }

    const livekit = await buildLiveKitSession(authToken, {
      conversationId: activeCall.conversationId,
      type: input.type,
      callId: activeCall.id,
    });

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

  const conversation = await chatService.getConversation(authToken, input.conversationId);
  const calleeUserIds = conversation.participants
    .map((participant) => participant.userId)
    .filter((id) => id !== currentUser.id);

  await assertDirectCallsAllowed(currentUser.id, calleeUserIds);
  await assertUsersAvailable(currentUser.id, calleeUserIds);

  const activeCall = storeCreateCallSession({
    conversationId: conversation.id,
    type: input.type,
    callerUserId: currentUser.id,
    callerName: currentUser.name,
    callerAvatarUrl: currentUser.avatarUrl,
    calleeUserIds,
  });

  const livekit = await buildLiveKitSession(authToken, {
    conversationId: conversation.id,
    type: input.type,
    callId: activeCall.id,
  });

  await chatService.notifyIncomingCall(authToken, {
    conversationId: livekit.conversationId,
    type: input.type,
    callerUserId: currentUser.id,
    callerName: currentUser.name,
    callerAvatarUrl: currentUser.avatarUrl,
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

export async function refreshCallToken(authToken: string, callId: string) {
  const session = await resolveCallSession(callId);
  if (!session || (session.status !== "ringing" && session.status !== "answered")) {
    throw new CallNotFoundError("Aucun appel actif à renouveler");
  }

  const currentUser = await chatService.getCurrentUser(authToken);
  assertCallParticipant(session, currentUser.id);

  const livekit = await buildLiveKitSession(authToken, {
    conversationId: session.conversationId,
    type: session.type,
    callId: session.id,
  });

  return {
    ...livekit,
    callId: session.id,
    role: session.callerUserId === currentUser.id ? ("caller" as const) : ("callee" as const),
  };
}

export async function signalCall(
  authToken: string,
  input: {
    callId: string;
    action: "cancel" | "decline" | "end";
    conversationId?: string;
    callType?: CallType;
    callerUserId?: string;
    durationSeconds?: number | null;
  },
) {
  const currentUser = await chatService.getCurrentUser(authToken);
  const session = await resolveCallSession(input.callId);

  if (!session) {
    throw new CallNotFoundError();
  }

  const isCaller = currentUser.id === session.callerUserId;
  const isCallee = session.calleeUserIds.includes(currentUser.id);
  if (!isCaller && !isCallee) {
    throw new CallForbiddenError("Appel non autorisé");
  }

  if (input.action === "cancel") {
    if (!isCaller) throw new CallForbiddenError("Seul l'appelant peut annuler l'appel");
    if (session.status !== "ringing") {
      throw new CallNotFoundError("Cet appel n'est plus en cours de sonnerie");
    }
    await chatService.publishCallCancelled(authToken, session);
    finalizeCall(session.id, "cancelled");
    return { ok: true as const, status: "cancelled" as const };
  }

  if (input.action === "decline") {
    if (!isCallee) throw new CallForbiddenError("Seul l'appelé peut refuser l'appel");
    if (session.status !== "ringing") {
      throw new CallNotFoundError("Cet appel n'est plus en cours de sonnerie");
    }
    await chatService.publishCallDeclined(authToken, session);
    finalizeCall(session.id, "declined");
    return { ok: true as const, status: "declined" as const };
  }

  await chatService.publishCallEnded(authToken, session);
  finalizeCall(session.id, "ended");
  return { ok: true as const, status: "ended" as const };
}

export async function getIncomingCallForUser(authToken: string) {
  const currentUser = await chatService.getCurrentUser(authToken);
  if (isUserBusy(currentUser.id) || (await isUserBusyInDb(currentUser.id))) {
    return null;
  }

  const session =
    findRingingCallForCallee(currentUser.id) ??
    (await findRingingCallForCalleeFromDb(currentUser.id));

  if (!session) {
    return null;
  }

  if (!getCallSession(session.id)) {
    hydrateCallSession(session);
  }

  return {
    callId: session.id,
    conversationId: session.conversationId,
    callerUserId: session.callerUserId,
    callerName: session.callerName,
    callerAvatarUrl: session.callerAvatarUrl,
    callType: session.type,
  };
}

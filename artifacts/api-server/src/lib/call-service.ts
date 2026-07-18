import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

import { chatService } from "./chat-service";
import { CallBusyError, CallForbiddenError, CallNotFoundError } from "./call-errors";
import {
  findRingingCallForCalleeFromDb,
  isUserBusyInDb,
  releaseStaleSessionsForNewCallInDb,
} from "./call-session-persistence";
import { logger } from "./logger";
import {
  getLiveKitConfig,
  isLiveKitConfigured,
  liveKitConfigHint,
} from "./livekit-config";
import {
  createCallSession as storeCreateCallSession,
  finalizeCall,
  findActiveCallByConversation,
  findRingingCallForCallee,
  getCallSession,
  hydrateCallSession,
  isUserBusy,
  markCallAnswered,
  markParticipantLeft,
  releaseStaleSessionsForNewCall,
  remainingCalleeIds,
  resolveCallSession,
  scheduleRingTimeout,
} from "./call-session-store";

export type CallType = "audio" | "video";
export type CallRole = "caller" | "callee";

const LIVEKIT_TOKEN_TTL_SECONDS = 10 * 60;

function requireLiveKitConfig() {
  if (!isLiveKitConfigured()) {
    throw new Error(`Configuration LiveKit manquante. ${liveKitConfigHint()}`);
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
  const { url: livekitUrl, apiKey: livekitApiKey, apiSecret: livekitApiSecret } =
    getLiveKitConfig();

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

  let token: string;
  try {
    token = await accessToken.toJwt();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Impossible de générer le token LiveKit (${detail}). ${liveKitConfigHint()}`,
    );
  }

  return {
    conversationId: conversation.id,
    roomName,
    token,
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
  input: {
    conversationId: string;
    type: CallType;
    role?: CallRole;
    callId?: string;
    calleeUserIds?: string[];
  },
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
  const allCalleeIds = conversation.participants
    .map((participant) => participant.userId)
    .filter((id) => id !== currentUser.id);
  const calleeUserIds =
    input.calleeUserIds?.filter((id) => allCalleeIds.includes(id)) ?? allCalleeIds;

  if (!calleeUserIds.length) {
    throw new CallForbiddenError("Aucun participant à appeler");
  }

  // Purge les sessions expirées (crash, redémarrage serveur) sans libérer les appels actifs.
  releaseStaleSessionsForNewCall(currentUser.id, conversation.id);
  await releaseStaleSessionsForNewCallInDb(currentUser.id, conversation.id);

  const existingRinging = findActiveCallByConversation(conversation.id);
  const canRejoinOutgoingRing =
    existingRinging &&
    existingRinging.status === "ringing" &&
    existingRinging.callerUserId === currentUser.id;
  const ignoreCallerCallId = canRejoinOutgoingRing ? existingRinging.id : undefined;

  if (conversation.type === "direct") {
    await assertDirectCallsAllowed(currentUser.id, calleeUserIds);
  } else {
    for (const calleeId of calleeUserIds) {
      try {
        await chatService.assertDirectCallAllowed(currentUser.id, calleeId);
      } catch {
        throw new CallForbiddenError("Appel impossible avec un des participants");
      }
    }
  }

  if (
    isUserBusy(currentUser.id, ignoreCallerCallId) ||
    (await isUserBusyInDb(currentUser.id, ignoreCallerCallId))
  ) {
    throw new CallBusyError("Vous êtes déjà en communication");
  }

  for (const calleeId of calleeUserIds) {
    if (isUserBusy(calleeId) || (await isUserBusyInDb(calleeId))) {
      throw new CallBusyError("Le destinataire est occupé");
    }
  }

  if (canRejoinOutgoingRing) {
    const livekit = await buildLiveKitSession(authToken, {
      conversationId: conversation.id,
      type: input.type,
      callId: existingRinging.id,
    });

    return {
      ...livekit,
      callId: existingRinging.id,
      role: "caller" as const,
    };
  }

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

  try {
    await chatService.notifyIncomingCall(authToken, {
      conversationId: livekit.conversationId,
      type: input.type,
      callerUserId: currentUser.id,
      callerName: currentUser.name,
      callerAvatarUrl: currentUser.avatarUrl,
      callId: activeCall.id,
      targetUserIds: calleeUserIds,
    });
  } catch (error) {
    logger.warn(
      { err: error, callId: activeCall.id },
      "Notification d'appel entrant échouée — session LiveKit conservée",
    );
  }

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
    action: "cancel" | "decline" | "end" | "leave";
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

  const conversation = await chatService.getConversation(authToken, session.conversationId);
  const isGroupCall = conversation.type === "group";
  const isCaller = currentUser.id === session.callerUserId;
  const isCallee = session.calleeUserIds.includes(currentUser.id);
  if (!isCaller && !isCallee) {
    throw new CallForbiddenError("Appel non autorisé");
  }

  // Signalisation idempotente : si la session est déjà finalisée (l'autre
  // participant a signalé en premier), on confirme sans erreur au lieu de
  // laisser une session bloquée ou de renvoyer un faux échec au client.
  const endAnsweredSession = async () => {
    await chatService.publishCallEnded(authToken, session);
    finalizeCall(session.id, "ended");
    return { ok: true as const, status: "ended" as const };
  };

  if (input.action === "leave") {
    if (!isGroupCall) {
      throw new CallForbiddenError("Action invalide pour cet appel");
    }
    if (isCaller) {
      throw new CallForbiddenError("Seul l'appelant peut terminer l'appel pour le groupe");
    }
    if (session.status !== "answered") {
      throw new CallForbiddenError("Impossible de quitter cet appel");
    }
    markParticipantLeft(session.id, currentUser.id);
    return { ok: true as const, status: "active" as const };
  }

  if (input.action === "cancel") {
    if (!isCaller) throw new CallForbiddenError("Seul l'appelant peut annuler l'appel");
    if (session.status === "answered") {
      // Course classique : l'appelé décroche pendant que l'appelant annule.
      // On termine proprement au lieu de laisser la session "answered" bloquée.
      return endAnsweredSession();
    }
    if (session.status !== "ringing") {
      return { ok: true as const, status: session.status };
    }
    await chatService.publishCallCancelled(authToken, session);
    finalizeCall(session.id, "cancelled");
    return { ok: true as const, status: "cancelled" as const };
  }

  if (input.action === "decline") {
    if (!isCallee) throw new CallForbiddenError("Seul l'appelé peut refuser l'appel");
    if (session.status === "answered") {
      if (isGroupCall) {
        markParticipantLeft(session.id, currentUser.id);
        return { ok: true as const, status: "active" as const };
      }
      return endAnsweredSession();
    }
    if (session.status !== "ringing") {
      return { ok: true as const, status: session.status };
    }
    if (isGroupCall) {
      markParticipantLeft(session.id, currentUser.id);
      if (remainingCalleeIds(session).length === 0) {
        await chatService.publishCallDeclined(authToken, session);
        finalizeCall(session.id, "declined");
        return { ok: true as const, status: "declined" as const };
      }
      return { ok: true as const, status: session.status };
    }
    await chatService.publishCallDeclined(authToken, session);
    finalizeCall(session.id, "declined");
    return { ok: true as const, status: "declined" as const };
  }

  if (isGroupCall && !isCaller) {
    throw new CallForbiddenError("Seul l'appelant peut terminer l'appel de groupe");
  }

  if (session.status !== "ringing" && session.status !== "answered") {
    return { ok: true as const, status: session.status };
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

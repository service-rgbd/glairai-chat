import { randomUUID } from "node:crypto";

import { CallBusyError } from "./call-errors";
import {
  expireStaleCallSessionsInDb,
  loadActiveCallSessionsFromDb,
  loadCallSessionFromDb,
  persistCallSession,
} from "./call-session-persistence";

export type CallSessionStatus = "ringing" | "answered" | "ended" | "cancelled" | "declined" | "missed";

export type ActiveCallSession = {
  id: string;
  conversationId: string;
  type: "audio" | "video";
  callerUserId: string;
  callerName: string;
  callerAvatarUrl: string | null;
  calleeUserIds: string[];
  /** Participants ayant quitté ou refusé — l'appel de groupe continue pour les autres. */
  leftUserIds: string[];
  status: CallSessionStatus;
  createdAt: number;
  answeredAt: number | null;
  callLogCreated: boolean;
};

const RING_TIMEOUT_MS = 30_000;
const LIVE_SESSION_STATUSES = new Set<CallSessionStatus>(["ringing", "answered"]);
const STALE_SESSION_MS = 20 * 60 * 1000;
// Une sonnerie dure 30 s max (RING_TIMEOUT_MS) : au-delà de 60 s, la session
// "ringing" est forcément fantôme (timer perdu après un redémarrage serveur).
const RINGING_STALE_MS = 60 * 1000;

function isSessionStale(session: ActiveCallSession) {
  if (session.status === "ringing") {
    return Date.now() - session.createdAt > RINGING_STALE_MS;
  }
  const anchor = session.answeredAt ?? session.createdAt;
  return Date.now() - anchor > STALE_SESSION_MS;
}

const sessions = new Map<string, ActiveCallSession>();
const byConversation = new Map<string, string>();
const timeoutHandles = new Map<string, ReturnType<typeof setTimeout>>();

function syncPersist(session: ActiveCallSession) {
  void persistCallSession(session).catch(() => undefined);
}

export function hydrateCallSession(session: ActiveCallSession) {
  sessions.set(session.id, session);
  if (session.status === "ringing") {
    byConversation.set(session.conversationId, session.id);
  }
}

export async function initializeCallSessionStore() {
  await expireStaleCallSessionsInDb();
  const active = await loadActiveCallSessionsFromDb();
  for (const session of active) {
    hydrateCallSession(session);
  }
  purgeStaleSessions();
  return active.length;
}

export async function resolveCallSession(callId: string) {
  const memory = getCallSession(callId);
  if (memory) return memory;

  const persisted = await loadCallSessionFromDb(callId);
  if (!persisted) return null;
  if (LIVE_SESSION_STATUSES.has(persisted.status)) {
    hydrateCallSession(persisted);
  }
  return persisted;
}

function isActiveCallParticipant(session: ActiveCallSession, userId: string) {
  if (session.leftUserIds.includes(userId)) return false;
  if (session.callerUserId === userId) return true;
  return session.calleeUserIds.includes(userId);
}

export function isUserBusy(userId: string, ignoreCallId?: string) {
  purgeStaleSessions();
  for (const session of sessions.values()) {
    if (ignoreCallId && session.id === ignoreCallId) continue;
    if (!LIVE_SESSION_STATUSES.has(session.status)) continue;
    if (isSessionStale(session)) continue;
    if (isActiveCallParticipant(session, userId)) return true;
  }
  return false;
}

function purgeStaleSessions() {
  for (const session of [...sessions.values()]) {
    if (!LIVE_SESSION_STATUSES.has(session.status)) continue;
    if (!isSessionStale(session)) continue;
    finalizeCall(session.id, session.status === "answered" ? "ended" : "missed");
  }
}

/** Purge uniquement les sessions expirées avant un nouvel appel (pas les appels actifs). */
export function releaseStaleSessionsForNewCall(userId: string, conversationId: string) {
  purgeStaleSessions();
  for (const session of [...sessions.values()]) {
    if (!LIVE_SESSION_STATUSES.has(session.status)) continue;
    if (!isSessionStale(session)) continue;
    if (session.conversationId !== conversationId && session.callerUserId !== userId) continue;
    finalizeCall(session.id, session.status === "answered" ? "ended" : "missed");
  }
}

export function findRingingCallForCallee(userId: string) {
  let latest: ActiveCallSession | null = null;
  for (const session of sessions.values()) {
    if (session.status !== "ringing" || !session.calleeUserIds.includes(userId)) continue;
    if (session.leftUserIds.includes(userId)) continue;
    if (!latest || session.createdAt > latest.createdAt) {
      latest = session;
    }
  }
  return latest;
}

export function findActiveCallByConversation(conversationId: string) {
  const callId = byConversation.get(conversationId);
  if (!callId) return null;
  const session = sessions.get(callId);
  if (!session || session.status !== "ringing") return null;
  return session;
}

export function getCallSession(callId: string) {
  return sessions.get(callId) ?? null;
}

export function markCallLogCreated(callId: string) {
  const session = sessions.get(callId);
  if (!session) return false;
  if (session.callLogCreated) return false;
  session.callLogCreated = true;
  syncPersist(session);
  return true;
}

export function createCallSession(input: {
  conversationId: string;
  type: "audio" | "video";
  callerUserId: string;
  callerName: string;
  callerAvatarUrl?: string | null;
  calleeUserIds: string[];
}) {
  const existingId = byConversation.get(input.conversationId);
  if (existingId) {
    const existing = sessions.get(existingId);
    if (existing && existing.status === "ringing") {
      return existing;
    }
    cleanupCall(existingId);
  }

  if (isUserBusy(input.callerUserId)) {
    throw new CallBusyError("Vous êtes déjà en communication");
  }

  for (const calleeId of input.calleeUserIds) {
    if (isUserBusy(calleeId)) {
      throw new CallBusyError("Le destinataire est occupé");
    }
  }

  const session: ActiveCallSession = {
    id: randomUUID(),
    conversationId: input.conversationId,
    type: input.type,
    callerUserId: input.callerUserId,
    callerName: input.callerName,
    callerAvatarUrl: input.callerAvatarUrl ?? null,
    calleeUserIds: input.calleeUserIds,
    leftUserIds: [],
    status: "ringing",
    createdAt: Date.now(),
    answeredAt: null,
    callLogCreated: false,
  };

  sessions.set(session.id, session);
  byConversation.set(input.conversationId, session.id);
  syncPersist(session);
  return session;
}

export function markCallAnswered(callId: string) {
  const session = sessions.get(callId);
  if (!session || session.status !== "ringing") return null;
  session.status = "answered";
  session.answeredAt = Date.now();
  clearRingTimeout(callId);
  syncPersist(session);
  return session;
}

export function markParticipantLeft(callId: string, userId: string) {
  const session = sessions.get(callId);
  if (!session) return null;
  if (!session.leftUserIds.includes(userId)) {
    session.leftUserIds.push(userId);
    syncPersist(session);
  }
  return session;
}

export function remainingCalleeIds(session: ActiveCallSession) {
  return session.calleeUserIds.filter((id) => !session.leftUserIds.includes(id));
}

export function finalizeCall(callId: string, status: Exclude<CallSessionStatus, "ringing" | "answered">) {
  const session = sessions.get(callId);
  if (!session) return null;
  session.status = status;
  clearRingTimeout(callId);
  byConversation.delete(session.conversationId);
  sessions.delete(callId);
  syncPersist(session);
  return session;
}

export function scheduleRingTimeout(callId: string, onTimeout: () => void) {
  clearRingTimeout(callId);
  timeoutHandles.set(
    callId,
    setTimeout(() => {
      onTimeout();
    }, RING_TIMEOUT_MS),
  );
}

function clearRingTimeout(callId: string) {
  const handle = timeoutHandles.get(callId);
  if (handle) {
    clearTimeout(handle);
    timeoutHandles.delete(callId);
  }
}

function cleanupCall(callId: string) {
  const session = sessions.get(callId);
  if (!session) return;
  clearRingTimeout(callId);
  byConversation.delete(session.conversationId);
  sessions.delete(callId);
}

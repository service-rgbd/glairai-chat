import { randomUUID } from "node:crypto";

import { CallBusyError } from "./call-errors";
import {
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
  status: CallSessionStatus;
  createdAt: number;
  answeredAt: number | null;
  callLogCreated: boolean;
};

const RING_TIMEOUT_MS = 15_000;
const LIVE_SESSION_STATUSES = new Set<CallSessionStatus>(["ringing", "answered"]);

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
  const active = await loadActiveCallSessionsFromDb();
  for (const session of active) {
    hydrateCallSession(session);
  }
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

export function isUserBusy(userId: string, ignoreCallId?: string) {
  for (const session of sessions.values()) {
    if (ignoreCallId && session.id === ignoreCallId) continue;
    if (!LIVE_SESSION_STATUSES.has(session.status)) continue;
    if (session.callerUserId === userId) return true;
    if (session.calleeUserIds.includes(userId)) return true;
  }
  return false;
}

export function findRingingCallForCallee(userId: string) {
  let latest: ActiveCallSession | null = null;
  for (const session of sessions.values()) {
    if (session.status !== "ringing" || !session.calleeUserIds.includes(userId)) continue;
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

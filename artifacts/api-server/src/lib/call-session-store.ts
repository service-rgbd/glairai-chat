import { randomUUID } from "node:crypto";

export type CallSessionStatus = "ringing" | "answered" | "ended" | "cancelled" | "declined" | "missed";

export type ActiveCallSession = {
  id: string;
  conversationId: string;
  type: "audio" | "video";
  callerUserId: string;
  callerName: string;
  calleeUserIds: string[];
  status: CallSessionStatus;
  createdAt: number;
  answeredAt: number | null;
};

const RING_TIMEOUT_MS = 45_000;
const sessions = new Map<string, ActiveCallSession>();
const byConversation = new Map<string, string>();
const timeoutHandles = new Map<string, ReturnType<typeof setTimeout>>();

export function findRingingCallForCallee(userId: string) {
  for (const session of sessions.values()) {
    if (session.status === "ringing" && session.calleeUserIds.includes(userId)) {
      return session;
    }
  }
  return null;
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

export function createCallSession(input: {
  conversationId: string;
  type: "audio" | "video";
  callerUserId: string;
  callerName: string;
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

  const session: ActiveCallSession = {
    id: randomUUID(),
    conversationId: input.conversationId,
    type: input.type,
    callerUserId: input.callerUserId,
    callerName: input.callerName,
    calleeUserIds: input.calleeUserIds,
    status: "ringing",
    createdAt: Date.now(),
    answeredAt: null,
  };

  sessions.set(session.id, session);
  byConversation.set(input.conversationId, session.id);
  return session;
}

export function markCallAnswered(callId: string) {
  const session = sessions.get(callId);
  if (!session || session.status !== "ringing") return null;
  session.status = "answered";
  session.answeredAt = Date.now();
  clearRingTimeout(callId);
  return session;
}

export function finalizeCall(callId: string, status: Exclude<CallSessionStatus, "ringing" | "answered">) {
  const session = sessions.get(callId);
  if (!session) return null;
  session.status = status;
  clearRingTimeout(callId);
  byConversation.delete(session.conversationId);
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

import type { CallSession, CreateCallTokenInputType } from "@workspace/api-client-react";

import { getApiBaseUrl } from "./api-config";

export class CallRequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CallRequestError";
    this.status = status;
  }
}

export type CallRole = "caller" | "callee";
export type CallSignalAction = "cancel" | "decline" | "end" | "leave";

export type CallSignalMeta = {
  conversationId: string;
  callType: CreateCallTokenInputType;
  callerUserId: string;
  durationSeconds?: number | null;
};

export type PreparedCallSession = CallSession & {
  callId: string;
  role: CallRole;
};

export type PendingIncomingCall = {
  callId: string;
  conversationId: string;
  callerUserId: string;
  callerName: string;
  callerAvatarUrl?: string | null;
  callType: CreateCallTokenInputType;
};

async function getCallApi<T>(path: string, authToken: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}/api${path}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) {
    throw new CallRequestError(payload.message ?? "Impossible de gérer l'appel", response.status);
  }

  return payload as T;
}

async function postCallApi<T>(path: string, body: unknown, authToken: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}/api${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) {
    throw new CallRequestError(payload.message ?? "Impossible de gérer l'appel", response.status);
  }

  return payload as T;
}

export async function prepareOutgoingCall(
  conversationId: string,
  type: CreateCallTokenInputType,
  authToken: string,
  options?: { calleeUserIds?: string[] },
): Promise<PreparedCallSession> {
  return postCallApi(
    "/calls/token",
    {
      conversationId,
      type,
      role: "caller",
      ...(options?.calleeUserIds?.length ? { calleeUserIds: options.calleeUserIds } : {}),
    },
    authToken,
  );
}

export async function prepareIncomingCall(
  conversationId: string,
  type: CreateCallTokenInputType,
  callId: string,
  authToken: string,
): Promise<PreparedCallSession> {
  return postCallApi("/calls/token", { conversationId, type, role: "callee", callId }, authToken);
}

export async function signalConversationCall(
  callId: string,
  action: CallSignalAction,
  authToken: string,
  meta?: CallSignalMeta,
) {
  return postCallApi<{ ok: true; status: string }>(
    "/calls/signal",
    {
      callId,
      action,
      ...(meta ?? {}),
    },
    authToken,
  );
}

export async function fetchPendingIncomingCall(authToken: string) {
  const payload = await getCallApi<{ call: PendingIncomingCall | null }>(
    "/calls/incoming",
    authToken,
  );
  return payload.call;
}

export async function refreshConversationCallToken(callId: string, authToken: string) {
  return postCallApi<PreparedCallSession>("/calls/refresh-token", { callId }, authToken);
}

/** Compatibilité ascendante. */
export async function prepareConversationCall(
  conversationId: string,
  type: CreateCallTokenInputType,
  authToken: string,
  options?: { role?: CallRole; callId?: string; calleeUserIds?: string[] },
): Promise<PreparedCallSession> {
  if (options?.role === "callee" && options.callId) {
    return prepareIncomingCall(conversationId, type, options.callId, authToken);
  }
  return prepareOutgoingCall(conversationId, type, authToken, {
    calleeUserIds: options?.calleeUserIds,
  });
}

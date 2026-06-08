import type { CallSession, CreateCallTokenInputType } from "@workspace/api-client-react";

import { getApiBaseUrl } from "./api-config";

export type CallRole = "caller" | "callee";
export type CallSignalAction = "cancel" | "decline" | "end";

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
    throw new Error(payload.message ?? "Impossible de gérer l'appel");
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
    throw new Error(payload.message ?? "Impossible de gérer l'appel");
  }

  return payload as T;
}

export async function prepareOutgoingCall(
  conversationId: string,
  type: CreateCallTokenInputType,
  authToken: string,
): Promise<PreparedCallSession> {
  return postCallApi("/calls/token", { conversationId, type, role: "caller" }, authToken);
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

/** Compatibilité ascendante. */
export async function prepareConversationCall(
  conversationId: string,
  type: CreateCallTokenInputType,
  authToken: string,
  options?: { role?: CallRole; callId?: string },
): Promise<PreparedCallSession> {
  if (options?.role === "callee" && options.callId) {
    return prepareIncomingCall(conversationId, type, options.callId, authToken);
  }
  return prepareOutgoingCall(conversationId, type, authToken);
}

import type { CallMessageOutcome } from "@/lib/call-messages";
import type { CreateCallTokenInputType } from "@workspace/api-client-react";

import { getApiBaseUrl } from "./api-config";

export type CallLogInput = {
  callId: string;
  conversationId: string;
  callerUserId: string;
  callType: CreateCallTokenInputType;
  outcome: CallMessageOutcome;
  durationSeconds?: number | null;
};

export function resolveCallLogOutcome(input: {
  isIncoming: boolean;
  wasConnected: boolean;
  declined?: boolean;
}): CallMessageOutcome {
  if (input.wasConnected) return "completed";
  if (input.declined) return "declined";
  if (!input.isIncoming) return "cancelled";
  return "missed";
}

export async function logConversationCall(input: CallLogInput, authToken: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/calls/log`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => ({}))) as { message?: string; created?: boolean };
  if (!response.ok) {
    throw new Error(payload.message ?? "Impossible d'enregistrer l'appel dans la conversation");
  }

  return payload;
}

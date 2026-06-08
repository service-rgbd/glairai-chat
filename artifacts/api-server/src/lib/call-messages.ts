export type CallMessageOutcome = "completed" | "missed" | "declined" | "cancelled";

export interface CallMessagePayload {
  kind: "call";
  callId: string;
  callType: "audio" | "video";
  outcome: CallMessageOutcome;
  durationSeconds: number | null;
}

export function encodeCallMessagePayload(payload: CallMessagePayload) {
  return JSON.stringify(payload);
}

export function isCallMessageContent(content: string) {
  try {
    const parsed = JSON.parse(content) as Partial<CallMessagePayload>;
    return (
      parsed?.kind === "call" &&
      typeof parsed.callId === "string" &&
      (parsed.callType === "audio" || parsed.callType === "video")
    );
  } catch {
    return false;
  }
}

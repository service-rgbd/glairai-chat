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

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

export function parseCallMessagePayload(content: string): CallMessagePayload | null {
  try {
    const parsed = JSON.parse(content) as Partial<CallMessagePayload>;
    if (
      parsed?.kind !== "call" ||
      typeof parsed.callId !== "string" ||
      (parsed.callType !== "audio" && parsed.callType !== "video") ||
      (parsed.outcome !== "completed" &&
        parsed.outcome !== "missed" &&
        parsed.outcome !== "declined" &&
        parsed.outcome !== "cancelled")
    ) {
      return null;
    }
    return {
      kind: "call",
      callId: parsed.callId,
      callType: parsed.callType,
      outcome: parsed.outcome,
      durationSeconds:
        typeof parsed.durationSeconds === "number" && Number.isFinite(parsed.durationSeconds)
          ? Math.max(0, Math.round(parsed.durationSeconds))
          : null,
    };
  } catch {
    return null;
  }
}

export function getCallMessagePayloadFromContent(content: string): CallMessagePayload | null {
  return parseCallMessagePayload(content);
}

export function isCallMessageContent(content: string) {
  return getCallMessagePayloadFromContent(content) != null;
}

function formatCallDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  if (minutes > 0) {
    return `${minutes}:${remaining.toString().padStart(2, "0")}`;
  }
  return `0:${remaining.toString().padStart(2, "0")}`;
}

export function getCallMessageLabel(payload: CallMessagePayload, isCaller: boolean) {
  const mediaLabel = payload.callType === "video" ? "Appel vidéo" : "Appel vocal";

  if (payload.outcome === "completed") {
    if (payload.durationSeconds != null && payload.durationSeconds > 0) {
      return `${mediaLabel} · ${formatCallDuration(payload.durationSeconds)}`;
    }
    return mediaLabel;
  }

  if (payload.outcome === "missed") {
    return isCaller ? "Appel sans réponse" : "Appel manqué";
  }

  if (payload.outcome === "declined") {
    return "Appel refusé";
  }

  return isCaller ? "Appel sans réponse" : "Appel manqué";
}

export function isCallMessageNegative(payload: CallMessagePayload, isCaller: boolean) {
  if (payload.outcome === "completed") return false;
  if (payload.outcome === "declined") return true;
  if (payload.outcome === "missed") return !isCaller;
  return !isCaller;
}

export function getCallMessagePreview(content: string, currentUserId: string, senderId: string) {
  const payload = parseCallMessagePayload(content);
  if (!payload) return null;
  const isCaller = senderId === currentUserId;
  return getCallMessageLabel(payload, isCaller);
}

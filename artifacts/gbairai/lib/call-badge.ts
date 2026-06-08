import type { GCall } from "@/contexts/chats-types";

export function countUnreadMissedCalls(calls: GCall[], callsLastSeenAt: string | null) {
  if (!callsLastSeenAt) return 0;
  const seenAt = new Date(callsLastSeenAt).getTime();
  if (Number.isNaN(seenAt)) return 0;

  return calls.filter(
    (call) =>
      call.missed &&
      call.direction === "incoming" &&
      new Date(call.timestamp).getTime() > seenAt,
  ).length;
}

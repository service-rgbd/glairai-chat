import type { GCall } from "@/contexts/chats-types";

const now = Date.now();
const h = (hours: number) => new Date(now - hours * 3600000).toISOString();

export const MOCK_CALLS: GCall[] = [
  { id: "call1", userId: "u1", type: "audio", direction: "incoming", missed: false, failed: false, timestamp: h(0.5), duration: "3:42" },
  { id: "call2", userId: "u3", type: "video", direction: "outgoing", missed: false, failed: false, timestamp: h(2), duration: "12:05" },
  { id: "call3", userId: "u6", type: "audio", direction: "incoming", missed: true, failed: false, timestamp: h(26), duration: null },
  { id: "call4", userId: "u2", type: "audio", direction: "outgoing", missed: false, failed: false, timestamp: h(48), duration: "1:23" },
  { id: "call5", userId: "u4", type: "video", direction: "incoming", missed: true, failed: false, timestamp: h(72), duration: null },
  { id: "call6", userId: "u8", type: "audio", direction: "outgoing", missed: false, failed: false, timestamp: h(96), duration: "8:14" },
  { id: "call7", userId: "u5", type: "video", direction: "outgoing", missed: false, failed: true, timestamp: h(1.2), duration: null },
];

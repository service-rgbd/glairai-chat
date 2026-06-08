import type { GCall } from "@/contexts/chats-types";
import { groupItemsByHistoryDate } from "@/lib/format-timestamp";

export type CallHistorySection = {
  key: string;
  title: string;
  data: GCall[];
};

export function buildCallHistorySections(calls: GCall[]): CallHistorySection[] {
  return groupItemsByHistoryDate(calls);
}

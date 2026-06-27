import type { Channel } from "../types";

export const OFFICIAL_CHANNEL_PREFIX = "demo_chn_";

export function isOfficialChannel(channel: Pick<Channel, "id" | "isOfficial">) {
  return channel.isOfficial ?? channel.id.startsWith(OFFICIAL_CHANNEL_PREFIX);
}

export function canManageChannel(channel: Pick<Channel, "id" | "isOfficial" | "role">) {
  return !isOfficialChannel(channel) && channel.role === "owner";
}

export function canPublishOnChannel(channel: Pick<Channel, "id" | "isOfficial" | "role">) {
  return !isOfficialChannel(channel) && (channel.role === "owner" || channel.role === "admin");
}

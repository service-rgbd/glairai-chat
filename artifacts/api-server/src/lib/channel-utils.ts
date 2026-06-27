export const OFFICIAL_CHANNEL_PREFIX = "demo_chn_";
export const OFFICIAL_CHANNEL_OWNER_ID = "demo_channels_owner";

export function isOfficialChannel(channelId: string) {
  return channelId.startsWith(OFFICIAL_CHANNEL_PREFIX);
}

export function formatFollowersCount(count: number) {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(".0", "")} M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(".0", "")} K`;
  }
  return `${count}`;
}

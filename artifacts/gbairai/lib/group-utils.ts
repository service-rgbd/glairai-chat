import type { GChat, GUser } from "@/contexts/chats-types";

const GROUP_COLORS = ["#6D4AFF", "#00D4A4", "#FF6B6B", "#FFB347", "#4ECDC4", "#45B7D1"];

export function initialsFromName(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "GR"
  );
}

export function getGroupDisplayInitials(
  chat: Pick<GChat, "name" | "participantIds">,
  users: Record<string, GUser>,
  currentUserId: string,
) {
  if (chat.name?.trim()) {
    return initialsFromName(chat.name);
  }

  const memberInitials = chat.participantIds
    .filter((id) => id !== currentUserId)
    .slice(0, 2)
    .map((id) => users[id]?.initials?.[0] ?? users[id]?.name?.[0]?.toUpperCase() ?? "")
    .join("");

  return memberInitials || "GR";
}

export function getGroupDisplayColor(seed: string) {
  const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return GROUP_COLORS[total % GROUP_COLORS.length] ?? "#6D4AFF";
}

export function getGroupMemberCountLabel(count: number) {
  if (count <= 1) return "1 participant";
  return `${count} participants`;
}

export function parseGroupInviteToken(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const deepLinkMatch = trimmed.match(/[?&]token=([^&]+)/i);
  if (deepLinkMatch?.[1]) {
    return decodeURIComponent(deepLinkMatch[1]);
  }

  if (/^[a-f0-9]{32}$/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function buildGroupInviteShareMessage(title: string | null | undefined, inviteUrl: string) {
  const groupName = title?.trim() || "mon groupe";
  return `Rejoins "${groupName}" sur Gbairai : ${inviteUrl}`;
}

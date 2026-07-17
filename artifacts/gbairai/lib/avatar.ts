import { getDisplayMediaUrl } from "./media";

export function resolveAvatarUrl(avatar: string | null | undefined) {
  if (!avatar?.trim()) return null;

  const trimmed = avatar.trim();
  if (/^(file:|content:|ph:|assets-library:)/i.test(trimmed)) {
    return trimmed;
  }

  const resolved = getDisplayMediaUrl(trimmed, trimmed);
  return resolved || null;
}

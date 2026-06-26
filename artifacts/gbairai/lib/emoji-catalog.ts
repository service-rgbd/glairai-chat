import { useQuery } from "@tanstack/react-query";

import bundledEmojiCatalog from "@/assets/emoji-catalog.json";
import { getApiBaseUrl } from "./api-config";

export type EmojiCatalogItem = {
  id: string;
  emoji: string;
  label: string;
  fluentName: string;
  assetPath: string;
  group: string;
};

export type EmojiCatalogResponse = {
  items: EmojiCatalogItem[];
  groups: string[];
};

const MIN_REMOTE_CATALOG_ITEMS = 50;

function isEmojiCatalogResponse(value: unknown): value is EmojiCatalogResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as EmojiCatalogResponse;
  return Array.isArray(candidate.items) && Array.isArray(candidate.groups);
}

function resolveEmojiCatalog(value: unknown): EmojiCatalogResponse {
  if (isEmojiCatalogResponse(value) && value.items.length >= MIN_REMOTE_CATALOG_ITEMS) {
    return value;
  }
  if (isEmojiCatalogResponse(bundledEmojiCatalog) && bundledEmojiCatalog.items.length) {
    return bundledEmojiCatalog;
  }
  if (isEmojiCatalogResponse(value) && value.items.length) {
    return value;
  }
  throw new Error("Impossible de charger les émojis 3D");
}

export async function fetchEmoji3dCatalog() {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/emojis/3d`);
    if (!response.ok) {
      throw new Error("Impossible de charger les émojis 3D");
    }
    const payload = (await response.json()) as unknown;
    return resolveEmojiCatalog(payload);
  } catch {
    return resolveEmojiCatalog(bundledEmojiCatalog);
  }
}

export function useEmoji3dCatalog(enabled = true) {
  return useQuery({
    queryKey: ["emoji3d-catalog"],
    queryFn: fetchEmoji3dCatalog,
    enabled,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24 * 7,
  });
}

export function filterEmojiCatalogItems(
  catalog: EmojiCatalogResponse | undefined,
  options?: { group?: string; q?: string },
) {
  if (!catalog) return [];

  const q = options?.q?.trim().toLowerCase();
  let items = catalog.items;

  if (options?.group && options.group !== "all") {
    items = items.filter((item) => item.group === options.group);
  }

  if (q) {
    items = items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.fluentName.toLowerCase().includes(q) ||
        item.emoji.includes(q),
    );
  }

  return items;
}

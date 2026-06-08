import { useQuery } from "@tanstack/react-query";

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

export async function fetchEmoji3dCatalog() {
  const response = await fetch(`${getApiBaseUrl()}/api/emojis/3d`);
  if (!response.ok) {
    throw new Error("Impossible de charger les émojis 3D");
  }
  return response.json() as Promise<EmojiCatalogResponse>;
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

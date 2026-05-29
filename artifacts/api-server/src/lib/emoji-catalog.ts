import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { getFluentEmojiAssetsRoot } from "./emoji-assets";

export type EmojiCatalogItem = {
  id: string;
  emoji: string;
  label: string;
  fluentName: string;
  assetPath: string;
  group: string;
};

export type EmojiCatalog = {
  items: EmojiCatalogItem[];
  groups: string[];
};

function fluentEmojiSlug(fluentName: string) {
  return fluentName
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

let cachedCatalog: EmojiCatalog | null = null;

export async function getEmoji3dCatalog(): Promise<EmojiCatalog> {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const root = getFluentEmojiAssetsRoot();
  const entries = await readdir(root, { withFileTypes: true });
  const items: EmojiCatalogItem[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const fluentName = entry.name;
    const assetPath = `${fluentName}/3D/${fluentEmojiSlug(fluentName)}_3d.png`;
    const assetFullPath = path.join(root, assetPath);

    try {
      await access(assetFullPath);
    } catch {
      continue;
    }

    let emoji = "❓";
    let label = fluentName;
    let group = "Autres";

    try {
      const metadataRaw = await readFile(path.join(root, fluentName, "metadata.json"), "utf8");
      const metadata = JSON.parse(metadataRaw) as {
        glyph?: string;
        cldr?: string;
        tts?: string;
        group?: string;
      };
      emoji = metadata.glyph ?? emoji;
      label = metadata.cldr ?? metadata.tts ?? label;
      group = metadata.group ?? group;
    } catch {
      // metadata optional
    }

    items.push({
      id: fluentEmojiSlug(fluentName),
      emoji,
      label,
      fluentName,
      assetPath,
      group,
    });
  }

  items.sort((a, b) => a.label.localeCompare(b.label, "fr"));
  const groups = [...new Set(items.map((item) => item.group))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );

  cachedCatalog = { items, groups };
  return cachedCatalog;
}

export function filterEmojiCatalog(
  catalog: EmojiCatalog,
  options?: { group?: string; q?: string },
): EmojiCatalog {
  const q = options?.q?.trim().toLowerCase();
  let items = catalog.items;

  if (options?.group) {
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

  return { items, groups: catalog.groups };
}

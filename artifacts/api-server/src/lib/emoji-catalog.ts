import { existsSync } from "node:fs";
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

const BUILTIN_EMOJI_CATALOG: EmojiCatalog = {
  items: [
    { id: "heart", emoji: "❤️", label: "J'aime", fluentName: "Red heart", assetPath: "Red heart/3D/red_heart_3d.png", group: "Favoris" },
    { id: "laugh", emoji: "😂", label: "Rire", fluentName: "Face with tears of joy", assetPath: "Face with tears of joy/3D/face_with_tears_of_joy_3d.png", group: "Favoris" },
    { id: "wow", emoji: "😮", label: "Wow", fluentName: "Face with open mouth", assetPath: "Face with open mouth/3D/face_with_open_mouth_3d.png", group: "Favoris" },
    { id: "sad", emoji: "😢", label: "Triste", fluentName: "Crying face", assetPath: "Crying face/3D/crying_face_3d.png", group: "Favoris" },
    { id: "clap", emoji: "👏", label: "Bravo", fluentName: "Clapping hands", assetPath: "Clapping hands/3D/clapping_hands_3d.png", group: "Favoris" },
    { id: "pray", emoji: "🙏", label: "Merci", fluentName: "Folded hands", assetPath: "Folded hands/3D/folded_hands_3d.png", group: "Favoris" },
    { id: "smile", emoji: "😊", label: "Sourire", fluentName: "Smiling face with smiling eyes", assetPath: "Smiling face with smiling eyes/3D/smiling_face_with_smiling_eyes_3d.png", group: "Favoris" },
    { id: "fire", emoji: "🔥", label: "Feu", fluentName: "Fire", assetPath: "Fire/3D/fire_3d.png", group: "Favoris" },
    { id: "party", emoji: "🎉", label: "Fête", fluentName: "Party popper", assetPath: "Party popper/3D/party_popper_3d.png", group: "Favoris" },
    { id: "thumbsup", emoji: "👍", label: "Top", fluentName: "Thumbs up", assetPath: "Thumbs up/Default/3D/thumbs_up_3d_default.png", group: "Favoris" },
    { id: "love", emoji: "😍", label: "Amour", fluentName: "Smiling face with heart-eyes", assetPath: "Smiling face with heart-eyes/3D/smiling_face_with_heart_eyes_3d.png", group: "Favoris" },
  ],
  groups: ["Favoris"],
};

export async function getEmoji3dCatalog(): Promise<EmojiCatalog> {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const root = getFluentEmojiAssetsRoot();
  if (!existsSync(root)) {
    cachedCatalog = BUILTIN_EMOJI_CATALOG;
    return cachedCatalog;
  }

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

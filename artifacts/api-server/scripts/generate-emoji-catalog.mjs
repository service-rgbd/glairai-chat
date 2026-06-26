import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");

const assetsCandidates = [
  path.resolve(repoRoot, "artifacts/gbairai/assets/fluentui-emoji/assets"),
  path.resolve(repoRoot, "gbairai/assets/fluentui-emoji/assets"),
];

function fluentEmojiSlug(fluentName) {
  return fluentName
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function resolve3dAssetPath(root, fluentName) {
  const slug = fluentEmojiSlug(fluentName);
  const candidates = [
    `${fluentName}/3D/${slug}_3d.png`,
    `${fluentName}/Default/3D/${slug}_3d_default.png`,
    `${fluentName}/3D/${slug}_3d_default.png`,
  ];

  for (const relative of candidates) {
    try {
      await access(path.join(root, relative));
      return relative;
    } catch {
      // try next
    }
  }

  return null;
}

async function buildCatalog(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const items = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const fluentName = entry.name;
    const assetPath = await resolve3dAssetPath(root, fluentName);
    if (!assetPath) continue;

    let emoji = "❓";
    let label = fluentName;
    let group = "Autres";

    try {
      const metadataRaw = await readFile(path.join(root, fluentName, "metadata.json"), "utf8");
      const metadata = JSON.parse(metadataRaw);
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

  return { items, groups };
}

async function main() {
  const root = assetsCandidates.find((candidate) => existsSync(candidate));
  if (!root) {
    console.error("Dossier fluentui-emoji introuvable. Téléchargez-le dans artifacts/gbairai/assets/fluentui-emoji/");
    process.exit(1);
  }

  const catalog = await buildCatalog(root);
  const apiOutput = path.resolve(scriptDir, "../src/data/emoji-catalog.json");
  const clientOutput = path.resolve(repoRoot, "artifacts/gbairai/assets/emoji-catalog.json");

  await mkdir(path.dirname(apiOutput), { recursive: true });
  await writeFile(apiOutput, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  await writeFile(clientOutput, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

  console.log(`Catalogue généré : ${catalog.items.length} émojis, ${catalog.groups.length} catégories`);
  console.log(`→ ${apiOutput}`);
  console.log(`→ ${clientOutput}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

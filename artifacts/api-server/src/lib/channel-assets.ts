import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function getChannelAssetsRoot() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), "artifacts/api-server/channel-assets"),
    path.resolve(process.cwd(), "channel-assets"),
    path.resolve(currentDir, "../../channel-assets"),
    path.resolve(currentDir, "../../../channel-assets"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0]!;
}

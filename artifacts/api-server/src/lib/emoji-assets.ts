import { existsSync } from "node:fs";
import path from "node:path";

export function getFluentEmojiAssetsRoot() {
  const candidates = [
    path.resolve(process.cwd(), "artifacts/gbairai/assets/fluentui-emoji/assets"),
    path.resolve(process.cwd(), "../gbairai/assets/fluentui-emoji/assets"),
    path.resolve(__dirname, "../../../gbairai/assets/fluentui-emoji/assets"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0]!;
}

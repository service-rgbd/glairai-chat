import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function mergeEnvFile(envPath: string) {
  if (!fs.existsSync(envPath)) {
    return 0;
  }

  const parsed = dotenv.parse(fs.readFileSync(envPath, "utf8"));
  let loaded = 0;

  for (const [key, value] of Object.entries(parsed)) {
    if (!process.env[key] || process.env[key]?.trim() === "") {
      process.env[key] = value;
      loaded += 1;
    }
  }

  return loaded;
}

export function loadWorkspaceEnv() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(moduleDir, "..", "..", "..");
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(repoRoot, ".env.local"),
    path.resolve(repoRoot, ".env"),
  ];

  let totalLoaded = 0;
  const loadedFrom: string[] = [];

  for (const envPath of candidates) {
    const loaded = mergeEnvFile(envPath);
    if (loaded > 0) {
      totalLoaded += loaded;
      loadedFrom.push(envPath);
    }
  }

  return { totalLoaded, loadedFrom };
}

import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import fs from "node:fs";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "./schema";

const { Pool } = pg;

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, "..", "..", "..");
const envPath = path.resolve(workspaceRoot, ".env.local");

if (fs.existsSync(envPath)) {
  const parsed = dotenv.parse(fs.readFileSync(envPath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (!process.env[key] || process.env[key]?.trim() === "") {
      process.env[key] = value;
    }
  }
}

const connectionString = process.env.DATABASE_URL;

export const pool = connectionString
  ? new Pool({ connectionString })
  : null;

export const db = pool ? drizzle(pool, { schema }) : null;
export const hasDatabase = Boolean(pool);

export { runSqlMigrations } from "./migrate";
export * from "./schema";

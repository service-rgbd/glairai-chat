import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pool } from "./index";

function resolveMigrationsDir() {
  const candidates = [
    path.resolve(process.cwd(), "lib/db/migrations"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../lib/db/migrations"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Répertoire de migrations introuvable (cwd=${process.cwd()})`,
  );
}

export async function runSqlMigrations() {
  if (!pool) {
    return { applied: [] as string[], skipped: true as const };
  }

  const migrationsDir = resolveMigrationsDir();
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Répertoire de migrations introuvable: ${migrationsDir}`);
  }

  const client = await pool.connect();
  const applied: string[] = [];

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "schema_migrations" (
        "id" text PRIMARY KEY NOT NULL,
        "applied_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const { rows } = await client.query<{ id: string }>(
        `SELECT "id" FROM "schema_migrations" WHERE "id" = $1 LIMIT 1`,
        [file],
      );
      if (rows.length > 0) {
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8").trim();
      if (!sql) {
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(`INSERT INTO "schema_migrations" ("id") VALUES ($1)`, [file]);
        await client.query("COMMIT");
        applied.push(file);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
  }

  return { applied, skipped: false as const };
}

import type { ConversationMessage, ConversationSummary } from "@workspace/api-client-react";
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

const DB_NAME = "gbairai-local.db";
const SCHEMA_VERSION = 1;

let database: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase | null> | null = null;
let operationQueue: Promise<void> = Promise.resolve();

function enqueueOperation<T>(task: () => Promise<T>): Promise<T> {
  const run = operationQueue.then(task, task);
  operationQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function isSqliteLockError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("transaction") ||
    message.includes("rollback") ||
    message.includes("database is locked")
  );
}

async function ensureSchema(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      conversation_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
      ON messages(conversation_id, created_at);
  `);

  await db.runAsync(
    "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
    "schema_version",
    String(SCHEMA_VERSION),
  );
}

async function resetDatabaseFile() {
  if (database) {
    try {
      await database.closeAsync();
    } catch {
      // ignore close errors during recovery
    }
  }

  database = null;
  initPromise = null;

  try {
    await SQLite.deleteDatabaseAsync(DB_NAME);
  } catch {
    // ignore if database file does not exist yet
  }

  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await ensureSchema(db);
  database = db;
  return db;
}

async function getDatabase() {
  if (Platform.OS === "web") {
    return null;
  }

  if (database) {
    return database;
  }

  if (!initPromise) {
    initPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await ensureSchema(db);
      database = db;
      return db;
    })();
  }

  return initPromise;
}

async function runWrite(task: (db: SQLite.SQLiteDatabase) => Promise<void>) {
  await enqueueOperation(async () => {
    let db = await getDatabase();
    if (!db) return;

    try {
      await task(db);
      return;
    } catch (error) {
      if (!isSqliteLockError(error)) {
        throw error;
      }
    }

    db = await resetDatabaseFile();
    if (!db) return;
    await task(db);
  });
}

export async function initLocalDb() {
  return getDatabase();
}

export async function upsertConversations(conversations: ConversationSummary[]) {
  if (conversations.length === 0) return;
  await runWrite(async (db) => {
    for (const conversation of conversations) {
      const updatedAt = conversation.lastMessage?.createdAt ?? new Date().toISOString();
      await db.runAsync(
        "INSERT OR REPLACE INTO conversations (id, payload, updated_at) VALUES (?, ?, ?)",
        conversation.id,
        JSON.stringify(conversation),
        updatedAt,
      );
    }
  });
}

export async function listConversations() {
  const db = await getDatabase();
  if (!db) return [] as ConversationSummary[];

  try {
    const rows = await db.getAllAsync<{ payload: string }>(
      "SELECT payload FROM conversations ORDER BY updated_at DESC",
    );

    return rows
      .map((row) => {
        try {
          return JSON.parse(row.payload) as ConversationSummary;
        } catch {
          return null;
        }
      })
      .filter((conversation): conversation is ConversationSummary => conversation !== null);
  } catch (error) {
    if (!isSqliteLockError(error)) {
      throw error;
    }
    await resetDatabaseFile();
    return [];
  }
}

export async function upsertMessages(conversationId: string, messages: ConversationMessage[]) {
  if (messages.length === 0) return;
  await runWrite(async (db) => {
    for (const message of messages) {
      await db.runAsync(
        "INSERT OR REPLACE INTO messages (id, conversation_id, payload, created_at) VALUES (?, ?, ?, ?)",
        message.id,
        conversationId,
        JSON.stringify(message),
        message.createdAt,
      );
    }
  });
}

export async function listMessages(conversationId: string, limit = 500) {
  const db = await getDatabase();
  if (!db) return [] as ConversationMessage[];

  try {
    const rows = await db.getAllAsync<{ payload: string }>(
      "SELECT payload FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?",
      conversationId,
      limit,
    );

    return rows
      .map((row) => {
        try {
          return JSON.parse(row.payload) as ConversationMessage;
        } catch {
          return null;
        }
      })
      .filter((message): message is ConversationMessage => message !== null);
  } catch (error) {
    if (!isSqliteLockError(error)) {
      throw error;
    }
    await resetDatabaseFile();
    return [];
  }
}

export async function deleteMessage(messageId: string) {
  await runWrite(async (db) => {
    await db.runAsync("DELETE FROM messages WHERE id = ?", messageId);
  });
}

export async function clearLocalDb() {
  await runWrite(async (db) => {
    await db.execAsync(`
      DELETE FROM messages;
      DELETE FROM conversations;
    `);
  });
}

export async function getLocalDbStats() {
  const db = await getDatabase();
  if (!db) {
    return { conversations: 0, messages: 0 };
  }

  try {
    const conversationRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM conversations",
    );
    const messageRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM messages",
    );

    return {
      conversations: conversationRow?.count ?? 0,
      messages: messageRow?.count ?? 0,
    };
  } catch {
    return { conversations: 0, messages: 0 };
  }
}

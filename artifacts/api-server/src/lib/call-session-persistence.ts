import { callSessionsTable, db } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

import type { ActiveCallSession, CallSessionStatus } from "./call-session-store";

const LIVE_STATUSES: CallSessionStatus[] = ["ringing", "answered"];

function rowToSession(row: typeof callSessionsTable.$inferSelect): ActiveCallSession {
  let calleeUserIds: string[] = [];
  try {
    calleeUserIds = JSON.parse(row.calleeUserIds) as string[];
  } catch {
    calleeUserIds = [];
  }

  return {
    id: row.id,
    conversationId: row.conversationId,
    type: row.type === "video" ? "video" : "audio",
    callerUserId: row.callerUserId,
    callerName: row.callerName,
    callerAvatarUrl: row.callerAvatarUrl,
    calleeUserIds,
    status: row.status,
    createdAt: row.createdAt.getTime(),
    answeredAt: row.answeredAt?.getTime() ?? null,
    callLogCreated: row.callLogCreated,
  };
}

function sessionToRow(session: ActiveCallSession) {
  return {
    id: session.id,
    conversationId: session.conversationId,
    type: session.type,
    callerUserId: session.callerUserId,
    callerName: session.callerName,
    callerAvatarUrl: session.callerAvatarUrl,
    calleeUserIds: JSON.stringify(session.calleeUserIds),
    status: session.status,
    createdAt: new Date(session.createdAt),
    answeredAt: session.answeredAt ? new Date(session.answeredAt) : null,
    callLogCreated: session.callLogCreated,
    updatedAt: new Date(),
  };
}

export async function persistCallSession(session: ActiveCallSession) {
  if (!db) return;
  const row = sessionToRow(session);
  await db
    .insert(callSessionsTable)
    .values(row)
    .onConflictDoUpdate({
      target: callSessionsTable.id,
      set: {
        status: row.status,
        answeredAt: row.answeredAt,
        callLogCreated: row.callLogCreated,
        updatedAt: row.updatedAt,
      },
    });
}

export async function deletePersistedCallSession(callId: string) {
  if (!db) return;
  await db.delete(callSessionsTable).where(eq(callSessionsTable.id, callId));
}

export async function loadActiveCallSessionsFromDb() {
  if (!db) return [] as ActiveCallSession[];

  const rows = await db
    .select()
    .from(callSessionsTable)
    .where(inArray(callSessionsTable.status, LIVE_STATUSES));

  const staleBefore = Date.now() - 20 * 60 * 1000;
  const active: ActiveCallSession[] = [];

  for (const row of rows) {
    if (row.createdAt.getTime() < staleBefore) {
      await db
        .update(callSessionsTable)
        .set({ status: "missed", updatedAt: new Date() })
        .where(eq(callSessionsTable.id, row.id));
      continue;
    }
    active.push(rowToSession(row));
  }

  return active;
}

export async function loadCallSessionFromDb(callId: string) {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(callSessionsTable)
    .where(eq(callSessionsTable.id, callId))
    .limit(1);
  return row ? rowToSession(row) : null;
}

export async function findRingingCallForCalleeFromDb(userId: string) {
  if (!db) return null;

  const rows = await db
    .select()
    .from(callSessionsTable)
    .where(eq(callSessionsTable.status, "ringing"));

  let latest: ActiveCallSession | null = null;
  for (const row of rows) {
    const session = rowToSession(row);
    if (!session.calleeUserIds.includes(userId)) continue;
    if (!latest || session.createdAt > latest.createdAt) {
      latest = session;
    }
  }

  return latest;
}

export async function isUserBusyInDb(userId: string, ignoreCallId?: string) {
  if (!db) return false;

  const rows = await db
    .select()
    .from(callSessionsTable)
    .where(inArray(callSessionsTable.status, LIVE_STATUSES));

  for (const row of rows) {
    if (ignoreCallId && row.id === ignoreCallId) continue;
    const session = rowToSession(row);
    if (session.callerUserId === userId) return true;
    if (session.calleeUserIds.includes(userId)) return true;
  }

  return false;
}

export async function markPersistedCallLogCreated(callId: string) {
  if (!db) return;
  await db
    .update(callSessionsTable)
    .set({ callLogCreated: true, updatedAt: new Date() })
    .where(and(eq(callSessionsTable.id, callId), eq(callSessionsTable.callLogCreated, false)));
}

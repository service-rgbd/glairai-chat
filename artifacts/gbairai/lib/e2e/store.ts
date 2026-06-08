import { safeGetItem, safeSetItem } from "@/lib/safe-storage";
import type { StoredDeviceKeys, StoredSession } from "@/lib/e2e/types";

const DEVICE_ID_KEY = "@gbairai/e2e/device-id";
const DEVICE_KEYS_PREFIX = "@gbairai/e2e/device-keys:";
const SESSION_PREFIX = "@gbairai/e2e/session:";

function sessionKey(userId: string, peerUserId: string) {
  return `${SESSION_PREFIX}${userId}:${peerUserId}`;
}

function deviceKeysKey(userId: string) {
  return `${DEVICE_KEYS_PREFIX}${userId}`;
}

function randomDeviceId() {
  const random = Math.random().toString(36).slice(2);
  const timestamp = Date.now().toString(36);
  return `dev_${timestamp}_${random}`;
}

export async function getOrCreateDeviceId() {
  const existing = await safeGetItem(DEVICE_ID_KEY);
  if (existing?.trim()) return existing.trim();

  const created = randomDeviceId();
  await safeSetItem(DEVICE_ID_KEY, created);
  return created;
}

export async function loadDeviceKeys(userId: string) {
  const raw = await safeGetItem(deviceKeysKey(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredDeviceKeys;
  } catch {
    return null;
  }
}

export async function saveDeviceKeys(userId: string, keys: StoredDeviceKeys) {
  await safeSetItem(deviceKeysKey(userId), JSON.stringify(keys));
}

export async function loadSession(userId: string, peerUserId: string) {
  const raw = await safeGetItem(sessionKey(userId, peerUserId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function saveSession(userId: string, session: StoredSession) {
  await safeSetItem(sessionKey(userId, session.peerUserId), JSON.stringify(session));
}

export async function clearE2eStoreForUser(userId: string) {
  await safeSetItem(deviceKeysKey(userId), "");
}

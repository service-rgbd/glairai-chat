import AsyncStorage from "@react-native-async-storage/async-storage";

import * as Crypto from "expo-crypto";

import { safeGetItem, safeRemoveItem, safeSetItem } from "@/lib/safe-storage";
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

async function randomDeviceId() {
  const bytes = await Crypto.getRandomBytesAsync(12);
  const random = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `dev_${Date.now().toString(36)}_${random}`;
}

export async function getOrCreateDeviceId() {
  const existing = await safeGetItem(DEVICE_ID_KEY);
  if (existing?.trim()) return existing.trim();

  const created = await randomDeviceId();
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

export async function deleteSession(userId: string, peerUserId: string) {
  await safeRemoveItem(sessionKey(userId, peerUserId));
}

export async function clearAllSessionsForUser(userId: string) {
  const prefix = `${SESSION_PREFIX}${userId}:`;
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const sessionKeys = allKeys.filter((key) => key.startsWith(prefix));
    if (sessionKeys.length) {
      await AsyncStorage.multiRemove(sessionKeys);
    }
  } catch {
    // Ignoré — les sessions obsolètes seront recréées au prochain handshake.
  }
}

export async function clearE2eStoreForUser(userId: string) {
  await safeSetItem(deviceKeysKey(userId), "");
  await clearAllSessionsForUser(userId);
}

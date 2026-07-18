import AsyncStorage from "@react-native-async-storage/async-storage";

import * as Crypto from "expo-crypto";

import {
  clearE2eMasterKey,
  clearEncryptedPayload,
  loadEncryptedPayload,
  saveEncryptedPayload,
} from "@/lib/e2e/secure-payload";
import type { StoredDeviceKeys, StoredSession } from "@/lib/e2e/types";
import { getSecureItem, migrateLegacySecureItem, setSecureItem } from "@/lib/secure-storage";
import { safeGetItem, safeRemoveItem } from "@/lib/safe-storage";

const DEVICE_ID_KEY = "@gbairai/e2e/device-id";
const DEVICE_KEYS_PREFIX = "@gbairai/e2e/device-keys:";
const SESSION_PREFIX = "@gbairai/e2e/session:";
const LEGACY_PLAINTEXT_CACHE_PREFIX = "@gbairai/e2e/plaintext:";

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
  const existing = await getSecureItem(DEVICE_ID_KEY);
  if (existing?.trim()) return existing.trim();

  const legacy = await migrateLegacySecureItem(DEVICE_ID_KEY);
  if (legacy?.trim()) return legacy.trim();

  const created = await randomDeviceId();
  await setSecureItem(DEVICE_ID_KEY, created);
  return created;
}

export async function loadDeviceKeys(userId: string) {
  return loadEncryptedPayload<StoredDeviceKeys>(userId, deviceKeysKey(userId));
}

export async function saveDeviceKeys(userId: string, keys: StoredDeviceKeys) {
  await saveEncryptedPayload(userId, deviceKeysKey(userId), keys);
}

export async function loadSession(userId: string, peerUserId: string) {
  return loadEncryptedPayload<StoredSession>(userId, sessionKey(userId, peerUserId));
}

export async function saveSession(userId: string, session: StoredSession) {
  await saveEncryptedPayload(userId, sessionKey(userId, session.peerUserId), session);
}

export async function deleteSession(userId: string, peerUserId: string) {
  await clearEncryptedPayload(sessionKey(userId, peerUserId));
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
  await clearEncryptedPayload(deviceKeysKey(userId));
  await clearAllSessionsForUser(userId);
  await clearE2eMasterKey(userId);
  await purgeLegacyE2ePlaintextCache(userId);
}

export async function purgeLegacyE2ePlaintextCache(userId: string) {
  await safeRemoveItem(`${LEGACY_PLAINTEXT_CACHE_PREFIX}${userId}`);
}

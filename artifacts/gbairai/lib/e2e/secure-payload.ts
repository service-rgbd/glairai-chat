import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes } from "@noble/ciphers/utils.js";

import { base64ToBytes, bytesToBase64, utf8ToBytes } from "@/lib/e2e/bytes";
import { getSecureItem, removeSecureItem, setSecureItem } from "@/lib/secure-storage";
import { safeGetItem, safeRemoveItem, safeSetItem } from "@/lib/safe-storage";

const MASTER_KEY_PREFIX = "@gbairai/e2e/master-key:";

function masterKeyStorageKey(userId: string) {
  return `${MASTER_KEY_PREFIX}${userId}`;
}

async function getOrCreateMasterKey(userId: string) {
  const storageKey = masterKeyStorageKey(userId);
  const existing = await getSecureItem(storageKey);
  if (existing?.trim()) {
    return base64ToBytes(existing.trim());
  }

  const bytes = randomBytes(32);
  const encoded = bytesToBase64(bytes);
  await setSecureItem(storageKey, encoded);
  return bytes;
}

function encryptJson(masterKey: Uint8Array, value: unknown) {
  const nonce = randomBytes(12);
  const cipher = gcm(masterKey, nonce);
  const ciphertext = cipher.encrypt(utf8ToBytes(JSON.stringify(value)));
  return JSON.stringify({
    v: 1,
    n: bytesToBase64(nonce),
    ct: bytesToBase64(ciphertext),
  });
}

function decryptJson<T>(masterKey: Uint8Array, raw: string): T | null {
  try {
    const parsed = JSON.parse(raw) as { v?: number; n?: string; ct?: string };
    if (parsed?.v !== 1 || !parsed.n || !parsed.ct) {
      return JSON.parse(raw) as T;
    }
    const cipher = gcm(masterKey, base64ToBytes(parsed.n));
    const plaintext = cipher.decrypt(base64ToBytes(parsed.ct));
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    return null;
  }
}

export async function loadEncryptedPayload<T>(userId: string, storageKey: string) {
  const raw = await safeGetItem(storageKey);
  if (!raw?.trim()) return null;

  const masterKey = await getOrCreateMasterKey(userId);
  const decrypted = decryptJson<T>(masterKey, raw);
  if (decrypted) {
    if (!raw.includes('"v":1')) {
      await safeSetItem(storageKey, encryptJson(masterKey, decrypted));
    }
    return decrypted;
  }

  return null;
}

export async function saveEncryptedPayload(userId: string, storageKey: string, value: unknown) {
  const masterKey = await getOrCreateMasterKey(userId);
  await safeSetItem(storageKey, encryptJson(masterKey, value));
}

export async function clearEncryptedPayload(storageKey: string) {
  await safeRemoveItem(storageKey);
}

export async function clearE2eMasterKey(userId: string) {
  await removeSecureItem(masterKeyStorageKey(userId));
}

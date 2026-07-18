import { randomBytes } from "@noble/ciphers/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import { utf8ToBytes } from "@/lib/e2e/bytes";
import { getSecureItem, migrateLegacySecureItem, removeSecureItem, setSecureItem } from "@/lib/secure-storage";

const STORAGE_PREFIX = "gbairai:two-factor-pin:";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function hashPin(pin: string, salt: string) {
  const digest = bytesToHex(sha256(utf8ToBytes(`${salt}:${pin.trim()}`)));
  return `${salt}:${digest}`;
}

function normalizePin(pin: string) {
  return pin.replace(/\D/g, "");
}

export function isValidTwoFactorPin(pin: string) {
  const digits = normalizePin(pin);
  return digits.length >= 6 && digits.length <= 8;
}

export async function isTwoFactorEnabled(userId: string) {
  const stored = await getSecureItem(storageKey(userId));
  return Boolean(stored);
}

export async function setTwoFactorPin(userId: string, pin: string) {
  const digits = normalizePin(pin);
  if (!isValidTwoFactorPin(digits)) {
    throw new Error("Le code doit contenir entre 6 et 8 chiffres");
  }
  const salt = bytesToHex(randomBytes(16));
  const saved = await setSecureItem(storageKey(userId), hashPin(digits, salt));
  if (!saved) {
    throw new Error("Impossible d'enregistrer le code");
  }
}

export async function verifyTwoFactorPin(userId: string, pin: string) {
  let stored = await getSecureItem(storageKey(userId));
  if (!stored) {
    stored = await migrateLegacySecureItem(storageKey(userId));
  }
  if (!stored) {
    return true;
  }
  const [salt] = stored.split(":");
  if (!salt) {
    return false;
  }
  return stored === hashPin(normalizePin(pin), salt);
}

export async function clearTwoFactorPin(userId: string) {
  await removeSecureItem(storageKey(userId));
}

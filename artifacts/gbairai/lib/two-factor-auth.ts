import * as Crypto from "expo-crypto";

import { safeGetItem, safeRemoveItem, safeSetItem } from "@/lib/safe-storage";

const STORAGE_PREFIX = "gbairai:two-factor-pin:";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

async function hashPin(pin: string, salt: string) {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin.trim()}`,
  );
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
  const stored = await safeGetItem(storageKey(userId));
  return Boolean(stored);
}

export async function setTwoFactorPin(userId: string, pin: string) {
  const digits = normalizePin(pin);
  if (!isValidTwoFactorPin(digits)) {
    throw new Error("Le code doit contenir entre 6 et 8 chiffres");
  }
  const random = await Crypto.getRandomBytesAsync(16);
  const salt = Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const saved = await safeSetItem(storageKey(userId), await hashPin(digits, salt));
  if (!saved) {
    throw new Error("Impossible d'enregistrer le code");
  }
}

export async function verifyTwoFactorPin(userId: string, pin: string) {
  const stored = await safeGetItem(storageKey(userId));
  if (!stored) {
    return true;
  }
  const [salt] = stored.split(":");
  if (!salt) {
    return false;
  }
  return stored === (await hashPin(normalizePin(pin), salt));
}

export async function clearTwoFactorPin(userId: string) {
  await safeRemoveItem(storageKey(userId));
}

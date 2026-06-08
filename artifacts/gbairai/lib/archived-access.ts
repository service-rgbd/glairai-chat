import { safeGetItem, safeRemoveItem, safeSetItem } from "@/lib/safe-storage";

const STORAGE_PREFIX = "gbairai:archived-access:";
const STRIP_PINNED_PREFIX = "gbairai:archived-strip-pinned:";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function stripPinnedKey(userId: string) {
  return `${STRIP_PINNED_PREFIX}${userId}`;
}

function hashPassword(password: string, salt: string) {
  let hash = 5381;
  const input = `${salt}:${password.trim()}`;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return `${salt}:${(hash >>> 0).toString(36)}`;
}

export async function isArchivedAccessEnabled(userId: string) {
  const stored = await safeGetItem(storageKey(userId));
  return Boolean(stored);
}

export async function setArchivedAccessPassword(userId: string, password: string) {
  const trimmed = password.trim();
  if (trimmed.length < 4) {
    throw new Error("Le mot de passe doit contenir au moins 4 caractères");
  }
  const salt = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const saved = await safeSetItem(storageKey(userId), hashPassword(trimmed, salt));
  if (!saved) {
    throw new Error("Impossible d'enregistrer le mot de passe");
  }
}

export async function verifyArchivedAccessPassword(userId: string, password: string) {
  const stored = await safeGetItem(storageKey(userId));
  if (!stored) {
    return true;
  }
  const [salt] = stored.split(":");
  if (!salt) {
    return false;
  }
  return stored === hashPassword(password, salt);
}

export async function clearArchivedAccessPassword(userId: string) {
  await safeRemoveItem(storageKey(userId));
}

export async function isArchivedStripPinned(userId: string) {
  return (await safeGetItem(stripPinnedKey(userId))) === "1";
}

export async function setArchivedStripPinned(userId: string, pinned: boolean) {
  if (pinned) {
    await safeSetItem(stripPinnedKey(userId), "1");
    return;
  }
  await safeRemoveItem(stripPinnedKey(userId));
}

/** @deprecated Utiliser isArchivedStripPinned */
export async function isArchivedStripRevealed(userId: string) {
  return isArchivedStripPinned(userId);
}

/** @deprecated Utiliser setArchivedStripPinned */
export async function setArchivedStripRevealed(userId: string, revealed: boolean) {
  await setArchivedStripPinned(userId, revealed);
}

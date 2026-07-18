import * as SecureStore from "expo-secure-store";

import { safeGetItem, safeRemoveItem, safeSetItem } from "@/lib/safe-storage";

const SECURE_AVAILABLE = SecureStore.isAvailableAsync !== undefined;

export async function getSecureItem(key: string) {
  try {
    if (await SecureStore.isAvailableAsync()) {
      return await SecureStore.getItemAsync(key);
    }
  } catch {
    // Fallback below.
  }
  return safeGetItem(key);
}

export async function setSecureItem(key: string, value: string) {
  try {
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      await safeRemoveItem(key);
      return true;
    }
  } catch {
    // Fallback below.
  }
  return safeSetItem(key, value);
}

export async function removeSecureItem(key: string) {
  try {
    if (SECURE_AVAILABLE && (await SecureStore.isAvailableAsync())) {
      await SecureStore.deleteItemAsync(key);
    }
  } catch {
    // Continue clearing legacy storage.
  }
  await safeRemoveItem(key);
}

export async function migrateLegacySecureItem(key: string) {
  const legacy = await safeGetItem(key);
  if (!legacy?.trim()) return legacy;
  await setSecureItem(key, legacy);
  return legacy;
}

import { Platform } from "react-native";

import { safeGetItem, safeRemoveItem, safeSetItem } from "@/lib/safe-storage";

type SecureStoreModule = typeof import("expo-secure-store");

let secureStoreModule: SecureStoreModule | null | undefined;
let secureStoreProbe: Promise<boolean> | null = null;

async function loadSecureStore() {
  if (secureStoreModule !== undefined) {
    return secureStoreModule;
  }

  if (Platform.OS === "web") {
    secureStoreModule = null;
    return secureStoreModule;
  }

  try {
    const module = await import("expo-secure-store");
    secureStoreModule = module;
    return module;
  } catch {
    secureStoreModule = null;
    return secureStoreModule;
  }
}

async function isSecureStoreReady() {
  if (!secureStoreProbe) {
    secureStoreProbe = (async () => {
      const module = await loadSecureStore();
      if (!module?.isAvailableAsync) {
        return false;
      }
      try {
        return await module.isAvailableAsync();
      } catch {
        return false;
      }
    })();
  }
  return secureStoreProbe;
}

export async function getSecureItem(key: string) {
  try {
    if (await isSecureStoreReady()) {
      const SecureStore = (await loadSecureStore())!;
      return await SecureStore.getItemAsync(key);
    }
  } catch {
    // Fallback below.
  }
  return safeGetItem(key);
}

export async function setSecureItem(key: string, value: string) {
  try {
    if (await isSecureStoreReady()) {
      const SecureStore = (await loadSecureStore())!;
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
    if (await isSecureStoreReady()) {
      const SecureStore = (await loadSecureStore())!;
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

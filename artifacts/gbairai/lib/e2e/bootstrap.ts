import { generateDeviceKeys } from "@/lib/e2e/keys";
import { registerDeviceOnServer } from "@/lib/e2e/api";
import {
  clearAllSessionsForUser,
  getOrCreateDeviceId,
  loadDeviceKeys,
  saveDeviceKeys,
} from "@/lib/e2e/store";
import type { StoredDeviceKeys } from "@/lib/e2e/types";

let bootstrapPromise: Promise<StoredDeviceKeys | null> | null = null;
let registeredUserId: string | null = null;
let cachedKeys: StoredDeviceKeys | null = null;

export function resetE2eBootstrapCache() {
  registeredUserId = null;
  cachedKeys = null;
}

export async function ensureE2eDeviceRegistered(
  userId: string,
  options?: { forceRegister?: boolean },
) {
  if (!options?.forceRegister && registeredUserId === userId && cachedKeys) {
    return cachedKeys;
  }

  if (!options?.forceRegister && bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    try {
      let keys = await loadDeviceKeys(userId);
      const isNewKeys = !keys;
      if (!keys) {
        const deviceId = await getOrCreateDeviceId();
        keys = generateDeviceKeys(deviceId);
        await saveDeviceKeys(userId, keys);
        await clearAllSessionsForUser(userId);
      }

      try {
        await registerDeviceOnServer(keys);
        registeredUserId = userId;
        cachedKeys = keys;
        if (__DEV__) {
          console.log("[Gbairai] E2E: appareil enregistré sur le serveur", {
            deviceId: keys.deviceId,
            isNewKeys,
          });
        }
      } catch (error) {
        if (__DEV__) {
          console.warn(
            "[Gbairai] E2E: enregistrement serveur échoué (E2E_ENABLED sur Render ?):",
            error instanceof Error ? error.message : error,
          );
        }
      }

      return keys;
    } finally {
      bootstrapPromise = null;
    }
  })();

  return bootstrapPromise;
}

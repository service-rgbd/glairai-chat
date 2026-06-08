import { generateDeviceKeys } from "@/lib/e2e/keys";
import { registerDeviceOnServer } from "@/lib/e2e/api";
import {
  getOrCreateDeviceId,
  loadDeviceKeys,
  saveDeviceKeys,
} from "@/lib/e2e/store";

let bootstrapPromise: Promise<void> | null = null;

export async function ensureE2eDeviceRegistered(userId: string) {
  if (bootstrapPromise) {
    await bootstrapPromise;
    return loadDeviceKeys(userId);
  }

  bootstrapPromise = (async () => {
    const existing = await loadDeviceKeys(userId);
    if (existing) {
      try {
        await registerDeviceOnServer(existing);
      } catch {
        // Le serveur peut refuser si E2E_ENABLED=false — les clés locales restent valides.
      }
      return;
    }

    const deviceId = await getOrCreateDeviceId();
    const keys = generateDeviceKeys(deviceId);
    await saveDeviceKeys(userId, keys);
    await registerDeviceOnServer(keys);
  })();

  try {
    await bootstrapPromise;
  } finally {
    bootstrapPromise = null;
  }

  return loadDeviceKeys(userId);
}

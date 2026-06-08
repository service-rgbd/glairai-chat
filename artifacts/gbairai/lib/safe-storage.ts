import AsyncStorage from "@react-native-async-storage/async-storage";

let storageWritesDisabled = false;

function isStorageFullError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("out of space") ||
    message.includes("No space left on device") ||
    message.includes("NSCocoaErrorDomain Code=640")
  );
}

export function isStorageWritesDisabled() {
  return storageWritesDisabled;
}

export async function safeGetItem(key: string) {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    if (__DEV__) {
      console.warn("[Gbairai] AsyncStorage read failed:", key, error);
    }
    return null;
  }
}

export async function safeSetItem(key: string, value: string) {
  if (storageWritesDisabled) {
    return false;
  }

  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (isStorageFullError(error)) {
      storageWritesDisabled = true;
      console.warn(
        "[Gbairai] Stockage local saturé — écritures AsyncStorage suspendues. Libérez de l'espace sur l'appareil puis relancez l'app.",
      );
      return false;
    }
    if (__DEV__) {
      console.warn("[Gbairai] AsyncStorage write failed:", key, error);
    }
    return false;
  }
}

export async function safeRemoveItem(key: string) {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn("[Gbairai] AsyncStorage remove failed:", key, error);
    }
    return false;
  }
}

export async function safeMultiRemove(keys: string[]) {
  try {
    await AsyncStorage.multiRemove(keys);
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn("[Gbairai] AsyncStorage multiRemove failed:", error);
    }
    return false;
  }
}

export function scheduleSafeSetItem(key: string, value: string, delayMs = 900) {
  if (storageWritesDisabled) {
    return () => undefined;
  }

  const timer = setTimeout(() => {
    void safeSetItem(key, value);
  }, delayMs);

  return () => clearTimeout(timer);
}

export function resetStorageWriteGuard() {
  storageWritesDisabled = false;
}

export const E2E_CONTENT_PREFIX = "e2e:v1:";
export const E2E_PROTOCOL_INFO = "gbairai-e2e-v1";
export const E2E_FALLBACK_LABEL = "🔒 Message chiffré";
export const E2E_DECRYPTING_LABEL = "Déchiffrement…";
export const E2E_ONE_TIME_PREKEY_COUNT = 20;

export function isE2eEnabled() {
  return process.env.EXPO_PUBLIC_E2E_ENABLED === "true";
}

/** En production, refuser tout envoi en clair si le contact n'a pas de clés E2E. */
export function isE2eStrictMode() {
  if (process.env.EXPO_PUBLIC_E2E_STRICT === "false") {
    return false;
  }
  return !__DEV__;
}

export function isE2ePayload(content: string) {
  return content.startsWith(E2E_CONTENT_PREFIX);
}

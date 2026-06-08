export const E2E_CONTENT_PREFIX = "e2e:v1:";
export const E2E_PROTOCOL_INFO = "gbairai-e2e-v1";
export const E2E_FALLBACK_LABEL = "🔒 Message chiffré";
export const E2E_ONE_TIME_PREKEY_COUNT = 20;

/** Désactivé par défaut — comportement actuel (messages en clair). */
export function isE2eEnabled() {
  return process.env.EXPO_PUBLIC_E2E_ENABLED === "true";
}

export function isE2ePayload(content: string) {
  return content.startsWith(E2E_CONTENT_PREFIX);
}

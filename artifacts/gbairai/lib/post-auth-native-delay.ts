/** Délai avant CallKit après login. */
export const POST_AUTH_NATIVE_DELAY_MS = 3000;

/** Overlay appels — après CallKit. */
export const INCOMING_OVERLAY_DELAY_MS = 4000;

/** VoIP PushKit — après CallKit prêt. */
export const VOIP_PUSH_AFTER_CALLKIT_MS = 4000;

export function afterAuthNativeDelay(task: () => void, delayMs = POST_AUTH_NATIVE_DELAY_MS) {
  const timer = setTimeout(task, delayMs);
  return () => clearTimeout(timer);
}

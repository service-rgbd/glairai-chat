let registeredPushToken: string | null = null;

export function setRegisteredPushToken(token: string | null) {
  registeredPushToken = token?.trim() || null;
}

export function getRegisteredPushToken() {
  return registeredPushToken;
}

export function clearRegisteredPushToken() {
  registeredPushToken = null;
}

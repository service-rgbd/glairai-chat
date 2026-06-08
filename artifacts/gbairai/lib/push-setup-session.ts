let pushSetupSessionKey: string | null = null;

export function beginPushSetupSession(sessionKey: string) {
  if (pushSetupSessionKey === sessionKey) {
    return false;
  }
  pushSetupSessionKey = sessionKey;
  return true;
}

export function resetPushSetupSession() {
  pushSetupSessionKey = null;
}

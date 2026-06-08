type ActiveCall = {
  callSessionId: string;
  conversationId: string;
  startedAt: number;
};

/** Après ce délai, une session locale est considérée comme fantôme. */
const ACTIVE_CALL_TTL_MS = 3 * 60 * 1000;

let activeCall: ActiveCall | null = null;

export function setActiveCall(call: Omit<ActiveCall, "startedAt"> | null) {
  activeCall = call ? { ...call, startedAt: Date.now() } : null;
}

export function getActiveCall() {
  clearStaleActiveCall();
  return activeCall;
}

export function clearActiveCall() {
  activeCall = null;
}

export function clearStaleActiveCall() {
  if (!activeCall) return;
  if (Date.now() - activeCall.startedAt > ACTIVE_CALL_TTL_MS) {
    activeCall = null;
  }
}

export function assertCanStartCall(conversationId: string) {
  clearStaleActiveCall();
  if (!activeCall) return;
  if (activeCall.conversationId === conversationId) {
    clearActiveCall();
    return;
  }
  throw new Error("Vous êtes déjà en communication");
}

export function shouldAcceptIncomingCall(callSessionId: string) {
  clearStaleActiveCall();
  if (!activeCall) return true;
  return activeCall.callSessionId === callSessionId;
}

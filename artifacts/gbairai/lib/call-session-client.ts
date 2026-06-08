type ActiveCall = {
  callSessionId: string;
  conversationId: string;
};

let activeCall: ActiveCall | null = null;

export function setActiveCall(call: ActiveCall | null) {
  activeCall = call;
}

export function getActiveCall() {
  return activeCall;
}

export function assertCanStartCall(conversationId: string) {
  if (!activeCall) return;
  if (activeCall.conversationId === conversationId) return;
  throw new Error("Vous êtes déjà en communication");
}

export function shouldAcceptIncomingCall(callSessionId: string) {
  if (!activeCall) return true;
  return activeCall.callSessionId === callSessionId;
}

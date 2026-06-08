export type IncomingCallPayload = {
  callId: string;
  conversationId: string;
  callerUserId: string;
  callerName: string;
  callerAvatarUrl?: string | null;
  callType: "audio" | "video";
};

export type IncomingCallUiMode = "fullscreen" | "banner";

type Listener = (call: IncomingCallPayload | null) => void;
type UiModeListener = (mode: IncomingCallUiMode) => void;

let pendingCall: IncomingCallPayload | null = null;
let uiMode: IncomingCallUiMode = "fullscreen";
let callKitManaged = false;
const listeners = new Set<Listener>();
const uiModeListeners = new Set<UiModeListener>();

export function setIncomingCall(
  call: IncomingCallPayload | null,
  options?: { skipNativeDisplay?: boolean },
) {
  pendingCall = call;
  callKitManaged = call != null && options?.skipNativeDisplay === true;
  if (call) {
    if (!callKitManaged) {
      uiMode = "fullscreen";
      for (const listener of uiModeListeners) {
        listener(uiMode);
      }
      void import("@/lib/call-system-ui").then(({ displayNativeIncomingCall }) => {
        void displayNativeIncomingCall(call);
      });
    }
  } else {
    callKitManaged = false;
    void import("@/lib/call-system-ui").then(({ endAllNativeCalls }) => {
      endAllNativeCalls();
    });
  }
  for (const listener of listeners) {
    listener(pendingCall);
  }
}

export function isIncomingCallKitManaged() {
  return callKitManaged;
}

export function getIncomingCall() {
  return pendingCall;
}

export function subscribeIncomingCall(listener: Listener) {
  listeners.add(listener);
  listener(pendingCall);
  return () => {
    listeners.delete(listener);
  };
}

export function getIncomingCallUiMode() {
  return uiMode;
}

export function setIncomingCallUiMode(mode: IncomingCallUiMode) {
  uiMode = mode;
  for (const listener of uiModeListeners) {
    listener(uiMode);
  }
}

export function subscribeIncomingCallUiMode(listener: UiModeListener) {
  uiModeListeners.add(listener);
  listener(uiMode);
  return () => {
    uiModeListeners.delete(listener);
  };
}

export function clearIncomingCallIfMatches(callId?: string | null) {
  if (!pendingCall) return;
  if (callId && pendingCall.callId !== callId) return;
  setIncomingCall(null);
}

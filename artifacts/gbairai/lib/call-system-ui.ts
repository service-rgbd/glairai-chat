import { Platform } from "react-native";

import type { IncomingCallPayload } from "@/lib/incoming-call";
import { isExpoGo } from "@/lib/runtime-env";

type CallKeepModule = typeof import("react-native-callkeep").default;

let callKeep: CallKeepModule | null = null;
let initialized = false;
let listenersAttached = false;

type NativeCallHandlers = {
  onAnswer: (callId: string) => void;
  onEnd: (callId: string) => void;
};

let handlers: NativeCallHandlers | null = null;
const displayedCalls = new Set<string>();

function isNativeCallUiEnabled() {
  return !isExpoGo() && process.env.EXPO_PUBLIC_NATIVE_CALL_UI === "true";
}

function loadCallKeep() {
  if (callKeep) return callKeep;
  if (!isNativeCallUiEnabled()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    callKeep = require("react-native-callkeep").default as CallKeepModule;
    return callKeep;
  } catch {
    return null;
  }
}

function attachListeners(module: CallKeepModule) {
  if (listenersAttached) return;
  listenersAttached = true;

  module.addEventListener("answerCall", ({ callUUID }: { callUUID: string }) => {
    handlers?.onAnswer(callUUID);
  });

  module.addEventListener("endCall", ({ callUUID }: { callUUID: string }) => {
    handlers?.onEnd(callUUID);
  });
}

export async function setupNativeCallUi(nextHandlers: NativeCallHandlers) {
  handlers = nextHandlers;
  if (!isNativeCallUiEnabled()) return false;

  const module = loadCallKeep();
  if (!module) return false;

  try {
    await module.setup({
      ios: {
        appName: "Gbairai",
        supportsVideo: true,
        includesCallsInRecents: true,
      },
      android: {
        alertTitle: "Autorisations d'appel",
        alertDescription:
          "Gbairai a besoin d'accéder au téléphone pour afficher les appels entrants sur l'écran de verrouillage.",
        cancelButton: "Annuler",
        okButton: "Autoriser",
        additionalPermissions: [],
        foregroundService: {
          channelId: "com.gbairai.chat.calls",
          channelName: "Appels Gbairai",
          notificationTitle: "Appel en cours",
          notificationIcon: "ic_launcher",
        },
      },
    });
    await module.setAvailable(true);
    attachListeners(module);
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

export function isNativeCallUiAvailable() {
  return initialized && callKeep != null;
}

export function displayNativeIncomingCall(call: IncomingCallPayload) {
  const module = loadCallKeep();
  if (!module || !initialized) return false;
  if (displayedCalls.has(call.callId)) return true;

  try {
    module.displayIncomingCall(
      call.callId,
      call.callerName,
      call.callerName,
      "generic",
      call.callType === "video",
    );
    displayedCalls.add(call.callId);
    return true;
  } catch {
    return false;
  }
}

export function endNativeCall(callId: string) {
  const module = loadCallKeep();
  if (!module || !initialized) return;
  try {
    module.endCall(callId);
  } catch {
    // Best effort.
  }
  displayedCalls.delete(callId);
}

export function endAllNativeCalls() {
  const module = loadCallKeep();
  if (!module || !initialized) return;
  try {
    module.endAllCalls();
  } catch {
    // Best effort.
  }
  displayedCalls.clear();
}

export function reportNativeCallConnected(callId: string) {
  const module = loadCallKeep();
  if (!module || !initialized || Platform.OS !== "ios") return;
  try {
    module.reportConnectedOutgoingCallWithUUID(callId);
  } catch {
    // Best effort.
  }
}

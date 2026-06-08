import { Platform } from "react-native";

import type { IncomingCallPayload } from "@/lib/incoming-call";
import { isExpoGo } from "@/lib/runtime-env";

type CallKeepModule = typeof import("react-native-callkeep").default;

type NativeCallHandlers = {
  onAnswer: (callId: string) => void;
  onEnd: (callId: string) => void;
};

let callKeep: CallKeepModule | null = null;
let initialized = false;
let initializing: Promise<boolean> | null = null;
let listenersAttached = false;
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

export function registerNativeCallHandlers(nextHandlers: NativeCallHandlers) {
  handlers = nextHandlers;
}

async function setupCallKeepModule() {
  if (initialized) return true;
  if (initializing) return initializing;

  if (!handlers) return false;

  const module = loadCallKeep();
  if (!module) return false;

  initializing = (async () => {
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
      await new Promise((resolve) => setTimeout(resolve, 600));
      await module.setAvailable(true);
      attachListeners(module);
      initialized = true;
      return true;
    } catch {
      return false;
    } finally {
      initializing = null;
    }
  })();

  return initializing;
}

/** Initialise CallKit pour les handlers répondre / raccrocher (VoIP ou in-app). */
export async function setupNativeCallUi(nextHandlers: NativeCallHandlers) {
  registerNativeCallHandlers(nextHandlers);
  return setupCallKeepModule();
}

export async function ensureNativeCallUiReady() {
  if (!handlers) return false;
  return setupCallKeepModule();
}

export function isNativeCallUiAvailable() {
  return initialized && callKeep != null;
}

export async function displayNativeIncomingCall(call: IncomingCallPayload) {
  const ready = await ensureNativeCallUiReady();
  if (!ready) return false;

  const module = loadCallKeep();
  if (!module || displayedCalls.has(call.callId)) return displayedCalls.has(call.callId);

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

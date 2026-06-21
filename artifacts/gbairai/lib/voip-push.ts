import { Platform } from "react-native";

import type { IncomingCallPushData } from "@/lib/notifications";
import { setIncomingCall } from "@/lib/incoming-call";
import { shouldAcceptIncomingCall } from "@/lib/call-session-client";
import { isExpoGo } from "@/lib/runtime-env";

type VoipModule = typeof import("react-native-voip-push-notification").default;
type VoipTokenHandler = (token: string) => void;

let voipModule: VoipModule | null = null;
let listenersReady = false;
let tokenRequested = false;
let tokenHandler: VoipTokenHandler | null = null;

function isVoipPushEnabled() {
  return (
    Platform.OS === "ios" &&
    !isExpoGo() &&
    process.env.EXPO_PUBLIC_NATIVE_CALL_UI === "true" &&
    process.env.EXPO_PUBLIC_VOIP_PUSH_ENABLED === "true"
  );
}

/** true = enregistrement PushKit côté JS. false = voipRegistration natif (AppDelegate, recommandé). */
function isVoipJsRegisterEnabled() {
  return process.env.EXPO_PUBLIC_VOIP_JS_REGISTER === "true";
}

function loadVoipModule() {
  if (voipModule) return voipModule;
  if (!isVoipPushEnabled()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    voipModule = require("react-native-voip-push-notification").default as VoipModule;
    return voipModule;
  } catch {
    return null;
  }
}

function isIncomingCallPushData(data: unknown): data is IncomingCallPushData {
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  return (
    record.type === "incoming_call" &&
    typeof record.conversationId === "string" &&
    (record.callType === "audio" || record.callType === "video") &&
    typeof record.callerUserId === "string" &&
    typeof record.callerName === "string" &&
    typeof record.callId === "string"
  );
}

function handleVoipNotification(notification: unknown) {
  try {
    const payload =
      notification && typeof notification === "object"
        ? ((notification as Record<string, unknown>).data ?? notification)
        : notification;
    if (!isIncomingCallPushData(payload)) return;
    if (!shouldAcceptIncomingCall(payload.callId)) return;

    setIncomingCall(
      {
        callId: payload.callId,
        conversationId: payload.conversationId,
        callerUserId: payload.callerUserId,
        callerName: payload.callerName,
        callerAvatarUrl: payload.callerAvatarUrl ?? null,
        callType: payload.callType,
      },
      { skipNativeDisplay: true },
    );

    const module = loadVoipModule();
    module?.onVoipNotificationCompleted(payload.callId);
  } catch (error) {
    if (__DEV__) {
      console.warn("[Gbairai VoIP] notification handler failed", error);
    }
  }
}

export function prepareVoipPushListeners(onToken: VoipTokenHandler) {
  if (!isVoipPushEnabled()) {
    if (__DEV__) {
      console.log("[Gbairai] VoIP PushKit désactivé (EXPO_PUBLIC_VOIP_PUSH_ENABLED≠true)");
    }
    return;
  }

  tokenHandler = onToken;
  if (listenersReady) return;

  const module = loadVoipModule();
  if (!module) return;

  try {
    module.addEventListener("register", (token: string) => {
      if (typeof token === "string" && token.length > 0) {
        if (__DEV__) {
          console.log("[Gbairai] token VoIP PushKit reçu");
        }
        tokenHandler?.(token);
      }
    });
    module.addEventListener("notification", handleVoipNotification);
    listenersReady = true;
    if (__DEV__) {
      console.log("[Gbairai] listeners VoIP PushKit prêts");
    }
    if (isVoipJsRegisterEnabled()) {
      setTimeout(() => requestVoipPushTokenAfterCallKit(), 250);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn("[Gbairai VoIP] addEventListener failed", error);
    }
  }
}

export function requestVoipPushTokenAfterCallKit() {
  if (!isVoipPushEnabled() || tokenRequested) return;
  tokenRequested = true;

  if (!isVoipJsRegisterEnabled()) {
    if (__DEV__) {
      console.log("[Gbairai] registerVoipToken ignoré (PushKit natif via AppDelegate)");
    }
    return;
  }

  const module = loadVoipModule();
  if (!module) {
    tokenRequested = false;
    return;
  }

  if (__DEV__) {
    console.log("[Gbairai] VoIP PushKit — registerVoipToken (JS)");
  }

  try {
    module.registerVoipToken();
  } catch (error) {
    tokenRequested = false;
    if (__DEV__) {
      console.warn("[Gbairai VoIP] registerVoipToken failed", error);
    }
  }
}

export function setupVoipPushRegistration(onToken: VoipTokenHandler) {
  prepareVoipPushListeners(onToken);
  return () => undefined;
}

export function isVoipPushAvailable() {
  return isVoipPushEnabled() && loadVoipModule() != null;
}

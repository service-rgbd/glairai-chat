import { Platform } from "react-native";

import type { IncomingCallPushData } from "@/lib/notifications";
import { setIncomingCall } from "@/lib/incoming-call";
import { shouldAcceptIncomingCall } from "@/lib/call-session-client";
import { isExpoGo } from "@/lib/runtime-env";

type VoipModule = typeof import("react-native-voip-push-notification").default;

let voipModule: VoipModule | null = null;
let registered = false;

function isVoipPushEnabled() {
  return Platform.OS === "ios" && !isExpoGo() && process.env.EXPO_PUBLIC_NATIVE_CALL_UI === "true";
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
  const payload =
    notification && typeof notification === "object"
      ? ((notification as Record<string, unknown>).data ?? notification)
      : notification;
  if (!isIncomingCallPushData(payload)) return;
  if (!shouldAcceptIncomingCall(payload.callId)) return;

  setIncomingCall({
    callId: payload.callId,
    conversationId: payload.conversationId,
    callerUserId: payload.callerUserId,
    callerName: payload.callerName,
    callerAvatarUrl: payload.callerAvatarUrl ?? null,
    callType: payload.callType,
  });

  const module = loadVoipModule();
  module?.onVoipNotificationCompleted(payload.callId);
}

export function setupVoipPushRegistration(onToken: (token: string) => void) {
  if (!isVoipPushEnabled() || registered) {
    return () => undefined;
  }

  const module = loadVoipModule();
  if (!module) return () => undefined;

  registered = true;

  const onRegister = (token: string) => {
    if (typeof token === "string" && token.length > 0) {
      onToken(token);
    }
  };

  module.addEventListener("register", onRegister);
  module.addEventListener("notification", handleVoipNotification);
  module.registerVoipToken();

  return () => {
    module.removeEventListener("register", onRegister);
    module.removeEventListener("notification", handleVoipNotification);
    registered = false;
  };
}

export function isVoipPushAvailable() {
  return isVoipPushEnabled() && loadVoipModule() != null;
}

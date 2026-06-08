import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { setIncomingCall } from "@/lib/incoming-call";
import { isExpoGo } from "@/lib/runtime-env";

let notificationHandlerConfigured = false;
let pushRoutingConfigured = false;

export type IncomingCallPushData = {
  type: "incoming_call";
  conversationId: string;
  callType: "audio" | "video";
  callerUserId: string;
  callerName: string;
  callerAvatarUrl?: string | null;
  callId: string;
};

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

function showIncomingCallOverlay(data: IncomingCallPushData) {
  setIncomingCall({
    callId: data.callId,
    conversationId: data.conversationId,
    callerUserId: data.callerUserId,
    callerName: data.callerName,
    callerAvatarUrl: data.callerAvatarUrl ?? null,
    callType: data.callType,
  });
}

function ensureNotificationHandler() {
  if (notificationHandlerConfigured || isExpoGo()) {
    return;
  }

  notificationHandlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data;
      const isCall = isIncomingCallPushData(data);

      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });
}

export function setupPushNotificationRouting() {
  if (pushRoutingConfigured || isExpoGo()) {
    return () => undefined;
  }

  pushRoutingConfigured = true;
  ensureNotificationHandler();

  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data;
    if (!isIncomingCallPushData(data)) return;
    showIncomingCallOverlay(data);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (!isIncomingCallPushData(data)) return;
    showIncomingCallOverlay(data);
  });

  void Notifications.getLastNotificationResponseAsync().then((response) => {
    const data = response?.notification.request.content.data;
    if (!isIncomingCallPushData(data)) return;
    showIncomingCallOverlay(data);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
    pushRoutingConfigured = false;
  };
}

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    return null;
  }

  if (isExpoGo()) {
    return null;
  }

  ensureNotificationHandler();

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    status = requested.status;
  }

  if (status !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Messages",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 200, 250],
      lightColor: "#6D4AFF",
      sound: "default",
    });

    await Notifications.setNotificationChannelAsync("calls", {
      name: "Appels",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 800, 400, 800, 400, 800],
      lightColor: "#22C55E",
      sound: "incoming.wav",
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      undefined;

    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return token.data;
  } catch {
    return null;
  }
}

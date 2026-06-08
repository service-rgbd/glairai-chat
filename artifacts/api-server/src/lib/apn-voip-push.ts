import apn from "apn";

type VoipPushInput = {
  voipPushToken: string;
  callerName: string;
  conversationId: string;
  callType: "audio" | "video";
  callerUserId: string;
  callId: string;
  callerAvatarUrl?: string | null;
};

let provider: apn.Provider | null = null;

function getBundleId() {
  return process.env.APNS_BUNDLE_ID ?? "com.gbairai.chat";
}

function getProvider() {
  if (provider) return provider;

  const key = process.env.APNS_VOIP_KEY?.replace(/\\n/g, "\n");
  const keyId = process.env.APNS_VOIP_KEY_ID;
  const teamId = process.env.APNS_VOIP_TEAM_ID;

  if (!key || !keyId || !teamId) {
    return null;
  }

  provider = new apn.Provider({
    token: {
      key,
      keyId,
      teamId,
    },
    production: process.env.APNS_VOIP_PRODUCTION === "true",
  });

  return provider;
}

export function isVoipPushConfigured() {
  return getProvider() != null;
}

export async function sendVoipIncomingCallPushes(
  recipients: Array<{ voipPushToken: string | null }>,
  input: VoipPushInput,
) {
  const activeProvider = getProvider();
  if (!activeProvider) return 0;

  const tokens = recipients
    .map((item) => item.voipPushToken)
    .filter((token): token is string => typeof token === "string" && token.length > 8);

  if (!tokens.length) return 0;

  const notification = new apn.Notification();
  notification.topic = `${getBundleId()}.voip`;
  notification.pushType = "voip";
  notification.priority = 10;
  notification.expiry = Math.floor(Date.now() / 1000) + 60;
  notification.payload = {
    type: "incoming_call",
    conversationId: input.conversationId,
    callType: input.callType,
    callerUserId: input.callerUserId,
    callerName: input.callerName,
    callerAvatarUrl: input.callerAvatarUrl ?? null,
    callId: input.callId,
  };
  notification.aps = {
    alert: {
      title: input.callerName,
      body: input.callType === "video" ? "Appel vidéo entrant" : "Appel audio entrant",
    },
    sound: "incoming.wav",
  };

  const result = await activeProvider.send(notification, tokens);
  return result.sent.length;
}

export function shutdownVoipPushProvider() {
  provider?.shutdown();
  provider = null;
}

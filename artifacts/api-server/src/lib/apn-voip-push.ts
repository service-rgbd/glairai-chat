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

function stripEnvQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/** Normalise le contenu .p8 collé dans Render (guillemets, \\n, lignes manquantes). */
export function normalizeApnsVoipKey(raw: string | undefined) {
  if (!raw) return null;

  let key = stripEnvQuotes(raw).replace(/\\n/g, "\n").trim();
  if (!key) return null;

  if (!key.includes("BEGIN PRIVATE KEY")) {
    const body = key.replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/=]+$/.test(body)) {
      return null;
    }
    const lines = body.match(/.{1,64}/g) ?? [body];
    key = `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
  }

  return key;
}

function getBundleId() {
  return stripEnvQuotes(process.env.APNS_BUNDLE_ID ?? "com.gbairai.chat");
}

function readApnsVoipCredentials() {
  const key = normalizeApnsVoipKey(process.env.APNS_VOIP_KEY);
  const keyId = stripEnvQuotes(process.env.APNS_VOIP_KEY_ID ?? "");
  const teamId = stripEnvQuotes(process.env.APNS_VOIP_TEAM_ID ?? "");

  if (!key || !keyId || !teamId) {
    return null;
  }

  return {
    key,
    keyId,
    teamId,
    production: stripEnvQuotes(process.env.APNS_VOIP_PRODUCTION ?? "false") === "true",
  };
}

function getProvider() {
  if (provider) return provider;

  const credentials = readApnsVoipCredentials();
  if (!credentials) {
    return null;
  }

  provider = new apn.Provider({
    token: {
      key: credentials.key,
      keyId: credentials.keyId,
      teamId: credentials.teamId,
    },
    production: credentials.production,
  });

  return provider;
}

export function isVoipPushConfigured() {
  return readApnsVoipCredentials() != null;
}

/** Vérifie que la clé .p8 peut signer un JWT APNS (sans envoyer de push). */
export async function verifyApnsVoipCredentials() {
  const credentials = readApnsVoipCredentials();
  if (!credentials) {
    return { ok: false as const, reason: "missing_env" as const };
  }

  let probe: apn.Provider | null = null;
  try {
    probe = new apn.Provider({
      token: {
        key: credentials.key,
        keyId: credentials.keyId,
        teamId: credentials.teamId,
      },
      production: credentials.production,
    });
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false as const, reason: "invalid_key" as const, message };
  } finally {
    try {
      probe?.shutdown();
    } catch {
      // ignore
    }
  }
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

  try {
    const result = await activeProvider.send(notification, tokens);
    return result.sent.length;
  } catch {
    shutdownVoipPushProvider();
    throw new Error(
      "Push VoIP APNS échoué — vérifiez APNS_VOIP_KEY (.p8), APNS_VOIP_KEY_ID et APNS_VOIP_TEAM_ID sur Render",
    );
  }
}

export function shutdownVoipPushProvider() {
  provider?.shutdown();
  provider = null;
}

import { AccessToken } from "livekit-server-sdk";

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

function readLiveKitEnv(name: "LIVEKIT_URL" | "LIVEKIT_API_KEY" | "LIVEKIT_API_SECRET") {
  return stripEnvQuotes(process.env[name] ?? "");
}

export function getLiveKitConfig() {
  return {
    url: readLiveKitEnv("LIVEKIT_URL"),
    apiKey: readLiveKitEnv("LIVEKIT_API_KEY"),
    apiSecret: readLiveKitEnv("LIVEKIT_API_SECRET"),
  };
}

export function isLiveKitConfigured() {
  const config = getLiveKitConfig();
  return Boolean(config.url && config.apiKey && config.apiSecret);
}

export async function verifyLiveKitTokenGeneration() {
  const config = getLiveKitConfig();
  if (!config.url || !config.apiKey || !config.apiSecret) {
    return { ok: false as const, reason: "missing_env" as const };
  }

  try {
    const accessToken = new AccessToken(config.apiKey, config.apiSecret, {
      identity: "healthcheck",
      ttl: 60,
    });
    accessToken.addGrant({ roomJoin: true, room: "healthcheck" });
    const token = await accessToken.toJwt();
    if (!token) {
      return { ok: false as const, reason: "empty_token" as const };
    }
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false as const, reason: "token_error" as const, message };
  }
}

export function liveKitConfigHint() {
  return "Vérifiez LIVEKIT_URL, LIVEKIT_API_KEY et LIVEKIT_API_SECRET dans Render (LiveKit Cloud → Settings → Keys).";
}

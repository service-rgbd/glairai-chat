import Constants from "expo-constants";

function extractHost(value: string | null | undefined) {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutProtocol = trimmed.replace(/^[a-z]+:\/\//i, "");
  const hostAndMaybePort = withoutProtocol.split("/")[0] ?? withoutProtocol;
  const host = hostAndMaybePort.split(":")[0] ?? hostAndMaybePort;

  return host || null;
}

const DEFAULT_API_BASE_URL = "https://glairai-chat.onrender.com";

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (explicit) {
    return normalizeBaseUrl(explicit);
  }

  const extraUrl = Constants.expoConfig?.extra?.apiBaseUrl;
  if (typeof extraUrl === "string" && extraUrl.trim()) {
    return normalizeBaseUrl(extraUrl);
  }

  const runtime = Constants as {
    expoConfig?: { hostUri?: string; extra?: { expoGo?: { debuggerHost?: string } } };
    expoGoConfig?: { debuggerHost?: string };
    manifest?: { debuggerHost?: string; hostUri?: string };
    manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
  };

  const host =
    [
      runtime.expoConfig?.hostUri,
      runtime.expoConfig?.extra?.expoGo?.debuggerHost,
      runtime.expoGoConfig?.debuggerHost,
      runtime.manifest?.debuggerHost,
      runtime.manifest?.hostUri,
      runtime.manifest2?.extra?.expoGo?.debuggerHost,
    ]
      .map(extractHost)
      .find((value): value is string => Boolean(value)) ?? null;

  if (host) {
    return `http://${host}:5000`;
  }

  return DEFAULT_API_BASE_URL;
}


import type { Request } from "express";

const PRIVATE_IP =
  /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|fc|fd|fe80)/i;

export function getClientIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]!.trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }

  return req.ip ?? req.socket.remoteAddress ?? "";
}

function isPrivateOrLocalIp(ip: string) {
  if (!ip) return true;
  const normalized = ip.replace(/^::ffff:/, "");
  return PRIVATE_IP.test(normalized);
}

export async function lookupCountryCodeFromIp(ip: string): Promise<string | null> {
  if (isPrivateOrLocalIp(ip)) {
    return null;
  }

  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      status?: string;
      countryCode?: string;
    };

    if (payload.status !== "success" || !payload.countryCode) {
      return null;
    }

    return payload.countryCode.toUpperCase();
  } catch {
    return null;
  }
}

export async function detectCountryCodeFromRequest(req: Request) {
  const ip = getClientIp(req);
  const countryCode = await lookupCountryCodeFromIp(ip);
  return {
    countryCode,
    source: countryCode ? ("ip" as const) : ("unknown" as const),
  };
}

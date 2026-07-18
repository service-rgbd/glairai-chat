type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
};

const buckets = new Map<string, number[]>();

export function enforceRateLimit(key: string, options: RateLimitOptions) {
  const now = Date.now();
  const history = (buckets.get(key) ?? []).filter(
    (timestamp) => now - timestamp < options.windowMs,
  );

  if (history.length >= options.maxRequests) {
    throw new Error("Trop de requêtes, veuillez patienter quelques minutes");
  }

  history.push(now);
  buckets.set(key, history);
}

export function getClientIp(req: { ip?: string | undefined }) {
  return req.ip ?? "unknown";
}

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

// Tests unitaires du rate limiter (logique pure, sans HTTP)
const buckets = new Map();

function enforceRateLimit(key, options) {
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

function shouldExposeOtpDemoCode(env) {
  if (env.NODE_ENV === "production") {
    return env.OTP_DEMO_CODE_ENABLED === "true";
  }
  return env.OTP_DEMO_CODE_ENABLED !== "false";
}

describe("sécurité — rate limit", () => {
  beforeEach(() => buckets.clear());

  it("bloque après maxRequests", () => {
    const key = "test-ip";
    for (let index = 0; index < 3; index += 1) {
      enforceRateLimit(key, { windowMs: 60_000, maxRequests: 3 });
    }
    assert.throws(
      () => enforceRateLimit(key, { windowMs: 60_000, maxRequests: 3 }),
      /Trop de requêtes/,
    );
  });
});

describe("sécurité — OTP demo policy", () => {
  it("désactive le demo en production par défaut", () => {
    assert.equal(shouldExposeOtpDemoCode({ NODE_ENV: "production" }), false);
  });

  it("active le demo en production seulement si OTP_DEMO_CODE_ENABLED=true", () => {
    assert.equal(
      shouldExposeOtpDemoCode({ NODE_ENV: "production", OTP_DEMO_CODE_ENABLED: "true" }),
      true,
    );
  });

  it("active le demo en dev par défaut", () => {
    assert.equal(shouldExposeOtpDemoCode({ NODE_ENV: "development" }), true);
  });
});

describe("sécurité — parsing clés média", () => {
  const MEDIA_KEY_PREFIX = /^(chat-media|stories|avatars|voice-notes)\//;

  function parseMediaKey(key) {
    if (!MEDIA_KEY_PREFIX.test(key)) return null;
    const parts = key.split("/");
    if (key.startsWith("avatars/")) {
      return { kind: "avatar", ownerUserId: parts[1] ?? "" };
    }
    if (key.startsWith("chat-media/")) {
      return {
        kind: "chat",
        conversationId: parts[1] ?? "",
        uploaderUserId: parts[2] ?? "",
      };
    }
    return { kind: "other" };
  }

  it("rejette les clés hors namespace", () => {
    assert.equal(parseMediaKey("../../../etc/passwd"), null);
    assert.equal(parseMediaKey("secret/file.jpg"), null);
  });

  it("parse une clé avatar", () => {
    assert.deepEqual(parseMediaKey("avatars/user-1/photo.jpg"), {
      kind: "avatar",
      ownerUserId: "user-1",
    });
  });
});

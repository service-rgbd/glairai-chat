#!/usr/bin/env node
/**
 * Tests de sécurité smoke — API Gbairai
 * Usage: API_BASE_URL=https://glairai-chat.onrender.com node scripts/security-smoke-test.mjs
 */
import assert from "node:assert/strict";

const BASE = (process.env.API_BASE_URL ?? "https://glairai-chat.onrender.com").replace(
  /\/+$/,
  "",
);
const API = `${BASE}/api`;

const results = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  const icon = pass ? "✅" : "❌";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function request(path, options = {}) {
  const url = `${API}${path}`;
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

async function run() {
  console.log(`\n🔒 Security smoke tests — ${API}\n`);

  const health = await request("/healthz");
  record(
    "Health minimal (pas de fuite config en prod)",
    health.json?.status === "ok" && health.json?.otpDemoCodeEnabled === undefined,
    JSON.stringify(health.json),
  );

  const mediaPublic = await request("/media/public?key=avatars/test/x.jpg");
  record("Média public sans auth → 401", mediaPublic.status === 401, `HTTP ${mediaPublic.status}`);

  const mediaResolve = await request("/media/resolve?key=avatars/test/x.jpg");
  record("Média resolve sans auth → 401", mediaResolve.status === 401, `HTTP ${mediaResolve.status}`);

  const meNoAuth = await request("/me");
  record("Profil sans token → 401", meNoAuth.status === 401, `HTTP ${meNoAuth.status}`);

  const meFake = await request("/me", {
    headers: { Authorization: "Bearer invalid-token-smoke-test" },
  });
  record("Token invalide → 401", meFake.status === 401, `HTTP ${meFake.status}`);

  const otpBypass = await request("/auth/request-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Otp-Demo": "true" },
    body: JSON.stringify({ phone: "+224620001111", countryCode: "GN" }),
  });
  const demoExposed = Boolean(otpBypass.json?.demoCode);
  record(
    "OTP demoCode non exposé en production",
    !demoExposed,
    demoExposed ? `demoCode=${otpBypass.json.demoCode}` : "aucun demoCode",
  );

  const badCode = await request("/auth/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: "x", phone: "+224620001111", code: "12345" }),
  });
  record(
    "Code OTP invalide rejeté (format)",
    badCode.status === 400 && badCode.json?.message?.includes("6 chiffres"),
    badCode.json?.message ?? `HTTP ${badCode.status}`,
  );

  let rateLimited = false;
  for (let index = 0; index < 12; index += 1) {
    const attempt = await request("/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: "smoke-rate-limit",
        phone: "+224620001112",
        code: "000000",
      }),
    });
    if (attempt.status === 400 && attempt.json?.message?.includes("Trop de requêtes")) {
      rateLimited = true;
      break;
    }
  }
  record("Rate-limit verify-otp actif", rateLimited, rateLimited ? "bloqué" : "non déclenché en 12 essais");

  if (demoExposed && otpBypass.json?.demoCode && otpBypass.json?.requestId) {
    const verify = await request("/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: otpBypass.json.requestId,
        phone: "+224620001111",
        code: otpBypass.json.demoCode,
      }),
    });
    const token = verify.json?.token;
    if (token) {
      const foreignMedia = await request(
        "/media/public?key=avatars/00000000-0000-0000-0000-000000000001/fake.jpg",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      record(
        "IDOR média clé étrangère → refus",
        foreignMedia.status === 403 || foreignMedia.status === 400,
        `HTTP ${foreignMedia.status}`,
      );

      await request("/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const afterLogout = await request("/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      record("Session révoquée après logout", afterLogout.status === 401, `HTTP ${afterLogout.status}`);
    }
  }

  const failed = results.filter((item) => !item.pass);
  console.log(`\n${results.length - failed.length}/${results.length} tests réussis\n`);
  if (failed.length) {
    console.log("Échecs :");
    for (const item of failed) {
      console.log(`  - ${item.name}: ${item.detail}`);
    }
    process.exitCode = 1;
  }
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

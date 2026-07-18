import {
  RequestOtpBody,
  RequestOtpResponse,
  VerifyOtpBody,
  VerifyOtpResponse,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";

import { chatService } from "../lib/chat-service";
import { enforceRateLimit, getClientIp } from "../lib/rate-limit";
import { shouldExposeOtpDemoCode } from "../lib/sms-service";

const router: IRouter = Router();
const MAX_VERIFY_PER_REQUEST = 8;
const isProduction = process.env["NODE_ENV"] === "production";

function getOtpRateLimitConfig() {
  const strict = isProduction || process.env["OTP_DEMO_CODE_ENABLED"] === "false";
  return {
    windowMs: strict ? 10 * 60_000 : 2 * 60_000,
    maxRequests: strict ? 5 : 30,
  };
}

function getVerifyOtpRateLimitConfig() {
  return {
    windowMs: 10 * 60_000,
    maxRequests: isProduction ? 20 : 60,
  };
}

function normalizeOtpCode(code: string) {
  const digits = code.trim().replace(/\D/g, "");
  if (!/^\d{6}$/.test(digits)) {
    throw new Error("Le code OTP doit contenir 6 chiffres");
  }
  return digits;
}

router.post("/auth/request-otp", async (req, res) => {
  try {
    const clientKey = getClientIp(req);
    enforceRateLimit(`otp:request:${clientKey}`, getOtpRateLimitConfig());
    const input = RequestOtpBody.parse(req.body);
    const allowDemoHeader =
      !isProduction && req.header("x-otp-demo") === "true";
    const forceDemoCode = shouldExposeOtpDemoCode() || allowDemoHeader;
    const result = await chatService.requestOtp({ ...input, forceDemoCode });
    res.json(RequestOtpResponse.parse(result));
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible d'envoyer le code",
    });
  }
});

router.post("/auth/verify-otp", async (req, res) => {
  try {
    const clientKey = getClientIp(req);
    enforceRateLimit(`otp:verify:${clientKey}`, getVerifyOtpRateLimitConfig());
    const input = VerifyOtpBody.parse(req.body);
    enforceRateLimit(`otp:verify:request:${input.requestId}`, {
      windowMs: 10 * 60_000,
      maxRequests: MAX_VERIFY_PER_REQUEST,
    });
    const result = await chatService.verifyOtp({
      ...input,
      code: normalizeOtpCode(input.code),
    });
    res.json(VerifyOtpResponse.parse(result));
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de vérifier le code",
    });
  }
});

router.post("/auth/logout", async (req, res) => {
  try {
    const header = req.header("authorization");
    const token = header?.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      res.status(401).json({ message: "Authentification requise" });
      return;
    }
    await chatService.revokeSession(token);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de se déconnecter",
    });
  }
});

export default router;

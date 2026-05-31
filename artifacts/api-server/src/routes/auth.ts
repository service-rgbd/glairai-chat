import {
  RequestOtpBody,
  RequestOtpResponse,
  VerifyOtpBody,
  VerifyOtpResponse,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";

import { chatService } from "../lib/chat-service";
import { logger } from "../lib/logger";
import { shouldExposeOtpDemoCode } from "../lib/sms-service";

const router: IRouter = Router();
const otpRateLimit = new Map<string, number[]>();

function getOtpRateLimitConfig() {
  const strict = process.env["OTP_DEMO_CODE_ENABLED"] === "false";
  return {
    windowMs: strict ? 10 * 60_000 : 2 * 60_000,
    maxRequests: strict ? 5 : 30,
  };
}

function getClientKey(req: { ip?: string | undefined }) {
  return req.ip ?? "unknown";
}

function enforceOtpRateLimit(clientKey: string) {
  const { windowMs, maxRequests } = getOtpRateLimitConfig();
  const now = Date.now();
  const history = (otpRateLimit.get(clientKey) ?? []).filter(
    (timestamp) => now - timestamp < windowMs,
  );

  if (history.length >= maxRequests) {
    throw new Error("Trop de demandes OTP, veuillez patienter quelques minutes");
  }

  history.push(now);
  otpRateLimit.set(clientKey, history);
}

router.post("/auth/request-otp", async (req, res) => {
  try {
    enforceOtpRateLimit(getClientKey(req));
    const input = RequestOtpBody.parse(req.body);
    const forceDemoCode =
      shouldExposeOtpDemoCode() || req.header("x-otp-demo") === "true";
    const result = await chatService.requestOtp({ ...input, forceDemoCode });
    if (forceDemoCode && !result.demoCode) {
      logger.warn("OTP demoCode manquant malgré forceDemoCode=true");
    }
    res.json(RequestOtpResponse.parse(result));
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible d'envoyer le code",
    });
  }
});

router.post("/auth/verify-otp", async (req, res) => {
  try {
    const input = VerifyOtpBody.parse(req.body);
    const result = await chatService.verifyOtp(input);
    res.json(VerifyOtpResponse.parse(result));
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de vérifier le code",
    });
  }
});

export default router;

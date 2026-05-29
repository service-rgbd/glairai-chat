import {
  RequestOtpBody,
  RequestOtpResponse,
  VerifyOtpBody,
  VerifyOtpResponse,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";

import { chatService } from "../lib/chat-service";

const router: IRouter = Router();
const otpRateLimit = new Map<string, number[]>();
const OTP_WINDOW_MS = 10 * 60_000;
const MAX_OTP_REQUESTS_PER_WINDOW = 5;

function getClientKey(req: { ip?: string | undefined }) {
  return req.ip ?? "unknown";
}

function enforceOtpRateLimit(clientKey: string) {
  const now = Date.now();
  const history = (otpRateLimit.get(clientKey) ?? []).filter(
    (timestamp) => now - timestamp < OTP_WINDOW_MS,
  );

  if (history.length >= MAX_OTP_REQUESTS_PER_WINDOW) {
    throw new Error("Trop de demandes OTP, veuillez patienter quelques minutes");
  }

  history.push(now);
  otpRateLimit.set(clientKey, history);
}

router.post("/auth/request-otp", async (req, res) => {
  try {
    enforceOtpRateLimit(getClientKey(req));
    const input = RequestOtpBody.parse(req.body);
    const result = await chatService.requestOtp(input);
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

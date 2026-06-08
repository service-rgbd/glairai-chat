import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

import { shouldExposeOtpDemoCode } from "../lib/sms-service";
import { isLiveKitConfigured, verifyLiveKitTokenGeneration } from "../lib/livekit-config";
import { isVoipPushConfigured } from "../lib/apn-voip-push";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  const livekitConfigured = isLiveKitConfigured();
  const livekitCheck = livekitConfigured ? await verifyLiveKitTokenGeneration() : null;

  res.json({
    ...data,
    otpDemoCodeEnabled: shouldExposeOtpDemoCode(),
    livekitConfigured,
    livekitTokenOk: livekitCheck?.ok ?? false,
    apnsVoipConfigured: isVoipPushConfigured(),
    ...(livekitCheck && !livekitCheck.ok && livekitCheck.reason === "token_error"
      ? { livekitError: livekitCheck.message }
      : {}),
  });
});

export default router;

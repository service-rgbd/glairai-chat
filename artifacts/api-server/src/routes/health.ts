import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

import { shouldExposeOtpDemoCode } from "../lib/sms-service";
import { isLiveKitConfigured, verifyLiveKitTokenGeneration } from "../lib/livekit-config";
import { isVoipPushConfigured, verifyApnsVoipCredentials } from "../lib/apn-voip-push";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  try {
    const data = HealthCheckResponse.parse({ status: "ok" });
    const livekitConfigured = isLiveKitConfigured();
    const livekitCheck = livekitConfigured ? await verifyLiveKitTokenGeneration() : null;
    const apnsVoipConfigured = isVoipPushConfigured();
    const apnsCheck = apnsVoipConfigured ? await verifyApnsVoipCredentials() : null;

    res.json({
      ...data,
      otpDemoCodeEnabled: shouldExposeOtpDemoCode(),
      livekitConfigured,
      livekitTokenOk: livekitCheck?.ok ?? false,
      apnsVoipConfigured,
      apnsVoipKeyOk: apnsCheck?.ok ?? false,
      ...(livekitCheck && !livekitCheck.ok && livekitCheck.reason === "token_error"
        ? { livekitError: livekitCheck.message }
        : {}),
      ...(apnsCheck && !apnsCheck.ok && apnsCheck.reason === "invalid_key"
        ? { apnsVoipError: apnsCheck.message }
        : {}),
    });
  } catch (error) {
    res.status(200).json({
      status: "ok",
      otpDemoCodeEnabled: shouldExposeOtpDemoCode(),
      healthDiagnosticsError: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

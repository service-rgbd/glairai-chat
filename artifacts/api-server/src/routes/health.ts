import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

import { shouldExposeOtpDemoCode } from "../lib/sms-service";
import { isLiveKitConfigured, verifyLiveKitTokenGeneration } from "../lib/livekit-config";
import {
  getApnsVoipEnvironment,
  isVoipPushConfigured,
  verifyApnsVoipCredentials,
} from "../lib/apn-voip-push";

const router: IRouter = Router();
const isProduction = process.env["NODE_ENV"] === "production";

router.get("/healthz", async (_req, res) => {
  try {
    const data = HealthCheckResponse.parse({ status: "ok" });

    if (isProduction) {
      res.json(data);
      return;
    }

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
      apnsVoipEnvironment: getApnsVoipEnvironment(),
      apnsVoipKeyOk: apnsCheck?.ok ?? false,
    });
  } catch (error) {
    res.status(200).json({
      status: "ok",
      ...(isProduction
        ? {}
        : {
            healthDiagnosticsError:
              error instanceof Error ? error.message : String(error),
          }),
    });
  }
});

export default router;

import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

import { shouldExposeOtpDemoCode } from "../lib/sms-service";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json({
    ...data,
    otpDemoCodeEnabled: shouldExposeOtpDemoCode(),
  });
});

export default router;

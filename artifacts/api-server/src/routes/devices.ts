import {
  RegisterDeviceTokenBody,
  RegisterDeviceTokenResponse,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";

import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { chatService } from "../lib/chat-service";

const router: IRouter = Router();

router.post("/devices/register", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const input = RegisterDeviceTokenBody.parse(req.body);
    const result = await chatService.registerDeviceToken(req.authToken!, input);
    res.json(RegisterDeviceTokenResponse.parse(result));
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Impossible d'enregistrer l'appareil",
    });
  }
});

router.post("/devices/unregister", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const pushToken = typeof req.body?.pushToken === "string" ? req.body.pushToken : "";
    const result = await chatService.unregisterDeviceToken(req.authToken!, { pushToken });
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Impossible de désinscrire l'appareil",
    });
  }
});

export default router;

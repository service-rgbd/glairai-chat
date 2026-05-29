import {
  GetCurrentUserResponse,
  UpdateCurrentUserBody,
  UpdateCurrentUserResponse,
  UpdatePresenceHeartbeatBody,
  UpdatePresenceHeartbeatResponse,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";

import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { chatService } from "../lib/chat-service";

const router: IRouter = Router();

router.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await chatService.getCurrentUser(req.authToken!);
    res.json(GetCurrentUserResponse.parse(result));
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de charger le profil",
    });
  }
});

router.patch("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const input = UpdateCurrentUserBody.parse(req.body);
    const result = await chatService.updateCurrentUser(req.authToken!, input);
    res.json(UpdateCurrentUserResponse.parse(result));
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de mettre à jour le profil",
    });
  }
});

router.post("/presence/heartbeat", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const input = UpdatePresenceHeartbeatBody.parse(req.body);
    const result = await chatService.updatePresenceHeartbeat(req.authToken!, input.isOnline);
    res.json(UpdatePresenceHeartbeatResponse.parse(result));
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de mettre à jour la présence",
    });
  }
});

export default router;

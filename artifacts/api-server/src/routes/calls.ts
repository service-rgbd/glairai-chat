import {
  CreateCallTokenBody,
  CreateCallTokenResponse,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";

import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { createCallSession } from "../lib/call-service";

const router: IRouter = Router();

router.post("/calls/token", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const input = CreateCallTokenBody.parse(req.body);
    const result = await createCallSession(req.authToken!, input);
    res.json(CreateCallTokenResponse.parse(result));
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Impossible de préparer l'appel",
    });
  }
});

export default router;

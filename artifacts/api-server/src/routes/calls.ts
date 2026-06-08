import {
  CreateCallTokenBody,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";

import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { createCallSession, getIncomingCallForUser, signalCall, type CallRole } from "../lib/call-service";

const router: IRouter = Router();

function parseCallRole(value: unknown): CallRole | undefined {
  if (value === "caller" || value === "callee") return value;
  return undefined;
}

router.get("/calls/incoming", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await getIncomingCallForUser(req.authToken!);
    res.json({ call: result });
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Impossible de récupérer l'appel entrant",
    });
  }
});

router.post("/calls/token", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const base = CreateCallTokenBody.parse(req.body);
    const role = parseCallRole(req.body?.role);
    const callId = typeof req.body?.callId === "string" ? req.body.callId : undefined;
    const result = await createCallSession(req.authToken!, { ...base, role, callId });
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Impossible de préparer l'appel",
    });
  }
});

router.post("/calls/signal", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const callId = typeof req.body?.callId === "string" ? req.body.callId : "";
    const action = req.body?.action;
    if (!callId || (action !== "cancel" && action !== "decline" && action !== "end")) {
      throw new Error("Requête d'appel invalide");
    }
    const result = await signalCall(req.authToken!, { callId, action });
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Impossible de mettre à jour l'appel",
    });
  }
});

export default router;

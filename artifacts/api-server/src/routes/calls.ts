import {
  CreateCallTokenBody,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";

import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { mapCallErrorStatus } from "../lib/call-errors";
import { chatService } from "../lib/chat-service";
import { createCallSession, getIncomingCallForUser, refreshCallToken, signalCall, type CallRole } from "../lib/call-service";

const router: IRouter = Router();

function parseCallRole(value: unknown): CallRole | undefined {
  if (value === "caller" || value === "callee") return value;
  return undefined;
}

function respondCallError(res: import("express").Response, error: unknown) {
  res.status(mapCallErrorStatus(error)).json({
    message:
      error instanceof Error ? error.message : "Impossible de traiter l'appel",
  });
}

router.get("/calls/incoming", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await getIncomingCallForUser(req.authToken!);
    res.json({ call: result });
  } catch (error) {
    respondCallError(res, error);
  }
});

router.post("/calls/token", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const base = CreateCallTokenBody.parse(req.body);
    const role = parseCallRole(req.body?.role);
    const callId = typeof req.body?.callId === "string" ? req.body.callId : undefined;
    const calleeUserIds = Array.isArray(base.calleeUserIds) ? base.calleeUserIds : undefined;
    const result = await createCallSession(req.authToken!, {
      ...base,
      role,
      callId,
      calleeUserIds,
    });
    res.json(result);
  } catch (error) {
    respondCallError(res, error);
  }
});

router.post("/calls/refresh-token", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const callId = typeof req.body?.callId === "string" ? req.body.callId : "";
    if (!callId) {
      throw new Error("Identifiant d'appel requis");
    }
    const result = await refreshCallToken(req.authToken!, callId);
    res.json(result);
  } catch (error) {
    respondCallError(res, error);
  }
});

router.post("/calls/signal", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const callId = typeof req.body?.callId === "string" ? req.body.callId : "";
    const action = req.body?.action;
    const conversationId =
      typeof req.body?.conversationId === "string" ? req.body.conversationId : undefined;
    const callType = req.body?.callType === "video" ? "video" : req.body?.callType === "audio" ? "audio" : undefined;
    const callerUserId =
      typeof req.body?.callerUserId === "string" ? req.body.callerUserId : undefined;
    const durationSeconds =
      typeof req.body?.durationSeconds === "number" ? req.body.durationSeconds : undefined;
    if (!callId || (action !== "cancel" && action !== "decline" && action !== "end")) {
      throw new Error("Requête d'appel invalide");
    }
    const result = await signalCall(req.authToken!, {
      callId,
      action,
      conversationId,
      callType,
      callerUserId,
      durationSeconds,
    });
    res.json(result);
  } catch (error) {
    respondCallError(res, error);
  }
});

router.post("/calls/log", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const callId = typeof req.body?.callId === "string" ? req.body.callId : "";
    const conversationId =
      typeof req.body?.conversationId === "string" ? req.body.conversationId : "";
    const callerUserId =
      typeof req.body?.callerUserId === "string" ? req.body.callerUserId : "";
    const callType = req.body?.callType === "video" ? "video" : "audio";
    const outcome = req.body?.outcome;
    const durationSeconds =
      typeof req.body?.durationSeconds === "number" ? req.body.durationSeconds : null;

    if (
      !callId ||
      !conversationId ||
      !callerUserId ||
      (outcome !== "completed" &&
        outcome !== "missed" &&
        outcome !== "declined" &&
        outcome !== "cancelled")
    ) {
      throw new Error("Requête de journal d'appel invalide");
    }

    const result = await chatService.recordCallLogMessage(req.authToken!, {
      callId,
      conversationId,
      callerUserId,
      callType,
      outcome,
      durationSeconds,
    });
    res.json(result);
  } catch (error) {
    respondCallError(res, error);
  }
});

export default router;

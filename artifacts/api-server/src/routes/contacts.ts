import {
  SyncContactsBody,
  SyncContactsResponse,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";

import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { chatService } from "../lib/chat-service";
import { enforceRateLimit, getClientIp } from "../lib/rate-limit";

const router: IRouter = Router();

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

router.get("/contacts", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await chatService.listSavedContacts(req.authToken!);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Impossible de charger les contacts enregistrés",
    });
  }
});

router.patch("/contacts/:phone", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const contactName =
      typeof req.body?.contactName === "string" ? req.body.contactName : "";
    const result = await chatService.updateSavedContact(
      req.authToken!,
      decodeURIComponent(getSingleParam(req.params.phone)),
      { contactName },
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Impossible de mettre à jour le contact",
    });
  }
});

router.post("/contacts/sync", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    enforceRateLimit(`contacts:sync:${getClientIp(req)}`, {
      windowMs: 10 * 60_000,
      maxRequests: 20,
    });
    const input = SyncContactsBody.parse(req.body);
    const result = await chatService.syncContacts(req.authToken!, input);
    res.json(SyncContactsResponse.parse(result));
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Impossible de synchroniser les contacts",
    });
  }
});

export default router;

import {
  SyncContactsBody,
  SyncContactsResponse,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";

import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { chatService } from "../lib/chat-service";

const router: IRouter = Router();

router.post("/contacts/sync", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
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

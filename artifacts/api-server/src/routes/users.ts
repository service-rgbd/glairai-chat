import { Router, type IRouter } from "express";

import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { chatService } from "../lib/chat-service";

const router: IRouter = Router();

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

router.get("/blocked-users", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await chatService.listBlockedUsers(req.authToken!);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Impossible de charger les utilisateurs bloqués",
    });
  }
});

router.post("/users/:userId/block", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await chatService.blockUser(
      req.authToken!,
      getSingleParam(req.params["userId"]),
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de bloquer cet utilisateur",
    });
  }
});

router.delete("/users/:userId/block", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await chatService.unblockUser(
      req.authToken!,
      getSingleParam(req.params["userId"]),
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de débloquer cet utilisateur",
    });
  }
});

export default router;

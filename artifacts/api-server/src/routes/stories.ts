import { Router, type IRouter } from "express";

import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { chatService } from "../lib/chat-service";

const router: IRouter = Router();

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

router.get("/stories", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await chatService.listStories(req.authToken!);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de charger les statuts",
    });
  }
});

router.post("/stories", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const type = typeof req.body?.type === "string" ? req.body.type : "text";
    const content = typeof req.body?.content === "string" ? req.body.content : "";
    const backgroundColor =
      typeof req.body?.backgroundColor === "string" ? req.body.backgroundColor : undefined;

    const result = await chatService.createStory(req.authToken!, {
      type: type as "text" | "image" | "video",
      content,
      backgroundColor,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de publier le statut",
    });
  }
});

router.post("/stories/:storyId/views", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await chatService.addStoryView(
      req.authToken!,
      getSingleParam(req.params.storyId),
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Impossible d'enregistrer la vue du statut",
    });
  }
});

router.post("/stories/:storyId/replies", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text : undefined;
    const emoji = typeof req.body?.emoji === "string" ? req.body.emoji : undefined;
    const result = await chatService.replyToStory(
      req.authToken!,
      getSingleParam(req.params.storyId),
      { text, emoji },
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Impossible d'envoyer la réponse au statut",
    });
  }
});

router.delete("/stories/:storyId", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await chatService.deleteStory(
      req.authToken!,
      getSingleParam(req.params.storyId),
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de supprimer le statut",
    });
  }
});

export default router;

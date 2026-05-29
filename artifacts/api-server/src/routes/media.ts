import { Router, type IRouter } from "express";

import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import {
  createAudioUploadTarget,
  createMediaUploadTarget,
  createSignedReadUrl,
  resolveMediaUrl,
} from "../lib/media-service";

const router: IRouter = Router();

router.post("/media/audio/upload-target", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const mimeType =
      typeof req.body?.mimeType === "string" ? req.body.mimeType : "audio/mp4";
    const result = await createAudioUploadTarget(req.authUserId!, mimeType);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Impossible de préparer l'upload audio",
    });
  }
});

router.post("/media/upload-target", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const category =
      typeof req.body?.category === "string" ? req.body.category : "";
    const mimeType =
      typeof req.body?.mimeType === "string" ? req.body.mimeType : "application/octet-stream";
    const conversationId =
      typeof req.body?.conversationId === "string" ? req.body.conversationId : undefined;

    const result = await createMediaUploadTarget({
      userId: req.authUserId!,
      category: category as Parameters<typeof createMediaUploadTarget>[0]["category"],
      mimeType,
      conversationId,
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Impossible de préparer l'upload média",
    });
  }
});

router.get("/media/resolve", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const key = typeof req.query["key"] === "string" ? req.query["key"].trim() : "";
    if (!key) {
      throw new Error("Clé média manquante");
    }
    res.json({ key, url: resolveMediaUrl(key) });
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Impossible de résoudre le média",
    });
  }
});

router.get("/media/public", async (req, res) => {
  try {
    const key = typeof req.query["key"] === "string" ? req.query["key"].trim() : "";
    if (!key) {
      throw new Error("Clé média manquante");
    }

    const directUrl = resolveMediaUrl(key);
    if (directUrl) {
      res.redirect(directUrl);
      return;
    }

    const signedUrl = await createSignedReadUrl(key);
    res.redirect(signedUrl);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Impossible d'ouvrir le média",
    });
  }
});

export default router;

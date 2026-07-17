import { Readable } from "node:stream";

import { Router, type IRouter } from "express";

import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import {
  createAudioUploadTarget,
  createMediaUploadTarget,
  getMediaReadUrl,
  openMediaObject,
  resolveMediaUrl,
} from "../lib/media-service";

const router: IRouter = Router();

function toNodeStream(body: unknown): Readable {
  if (body instanceof Readable) {
    return body;
  }

  if (
    body &&
    typeof body === "object" &&
    "transformToByteArray" in body &&
    typeof (body as { transformToByteArray?: unknown }).transformToByteArray === "function"
  ) {
    const readable = new Readable({ read() {} });
    void (body as { transformToByteArray: () => Promise<Uint8Array> })
      .transformToByteArray()
      .then((bytes) => {
        readable.push(Buffer.from(bytes));
        readable.push(null);
      })
      .catch((error: unknown) => {
        readable.destroy(error instanceof Error ? error : new Error("Lecture média impossible"));
      });
    return readable;
  }

  throw new Error("Flux média invalide");
}

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

router.get("/media/resolve", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const key = typeof req.query["key"] === "string" ? req.query["key"].trim() : "";
    if (!key) {
      throw new Error("Clé média manquante");
    }
    const url = await getMediaReadUrl(key);
    res.json({ key, url });
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

    const publicUrl = resolveMediaUrl(key);
    if (publicUrl) {
      res.redirect(publicUrl);
      return;
    }

    const object = await openMediaObject(key);
    res.setHeader("Content-Type", object.contentType);
    if (object.contentLength) {
      res.setHeader("Content-Length", String(object.contentLength));
    }
    res.setHeader("Cache-Control", "private, max-age=3600");
    toNodeStream(object.body).pipe(res);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Impossible d'ouvrir le média",
    });
  }
});

export default router;

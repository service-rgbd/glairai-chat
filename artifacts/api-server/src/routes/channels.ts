import { Router, type IRouter } from "express";

import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { channelService } from "../lib/channel-service";

const router: IRouter = Router();

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parseLimit(value: unknown) {
  if (typeof value !== "string") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

router.get("/channels/feed", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await channelService.getFeed(req.authToken!, {
      cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
      limit: parseLimit(req.query.limit),
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de charger le fil",
    });
  }
});

router.get("/channels/discovery", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await channelService.listDiscoverySections(req.authToken!);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de charger la découverte",
    });
  }
});

router.get("/channels", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await channelService.listChannels(req.authToken!, {
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
      limit: parseLimit(req.query.limit),
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de charger les chaînes",
    });
  }
});

router.post("/channels", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await channelService.createChannel(req.authToken!, {
      name: typeof req.body?.name === "string" ? req.body.name : "",
      description: typeof req.body?.description === "string" ? req.body.description : undefined,
      avatarUrl: typeof req.body?.avatarUrl === "string" ? req.body.avatarUrl : undefined,
      category: typeof req.body?.category === "string" ? req.body.category : undefined,
      isPublic: typeof req.body?.isPublic === "boolean" ? req.body.isPublic : undefined,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de créer la chaîne",
    });
  }
});

router.get("/channels/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await channelService.getChannel(req.authToken!, getSingleParam(req.params.id));
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Chaîne introuvable",
    });
  }
});

router.patch("/channels/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await channelService.updateChannel(req.authToken!, getSingleParam(req.params.id), {
      name: typeof req.body?.name === "string" ? req.body.name : undefined,
      description: typeof req.body?.description === "string" ? req.body.description : undefined,
      avatarUrl:
        req.body?.avatarUrl === null
          ? null
          : typeof req.body?.avatarUrl === "string"
            ? req.body.avatarUrl
            : undefined,
      category:
        req.body?.category === null
          ? null
          : typeof req.body?.category === "string"
            ? req.body.category
            : undefined,
      isPublic: typeof req.body?.isPublic === "boolean" ? req.body.isPublic : undefined,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de mettre à jour la chaîne",
    });
  }
});

router.delete("/channels/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await channelService.deleteChannel(req.authToken!, getSingleParam(req.params.id));
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de supprimer la chaîne",
    });
  }
});

router.post("/channels/:id/follow", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await channelService.followChannel(req.authToken!, getSingleParam(req.params.id));
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de suivre la chaîne",
    });
  }
});

router.delete("/channels/:id/follow", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await channelService.unfollowChannel(req.authToken!, getSingleParam(req.params.id));
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de se désabonner",
    });
  }
});

router.post("/channels/:id/posts", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const mediaType =
      typeof req.body?.mediaType === "string" ? req.body.mediaType : undefined;
    const result = await channelService.createPost(req.authToken!, getSingleParam(req.params.id), {
      content: typeof req.body?.content === "string" ? req.body.content : undefined,
      mediaUrl: typeof req.body?.mediaUrl === "string" ? req.body.mediaUrl : undefined,
      mediaType:
        mediaType === "text" || mediaType === "image" || mediaType === "video"
          ? mediaType
          : undefined,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de publier",
    });
  }
});

router.get("/channels/:id/posts", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await channelService.listChannelPosts(
      req.authToken!,
      getSingleParam(req.params.id),
      {
        cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
        limit: parseLimit(req.query.limit),
      },
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de charger les publications",
    });
  }
});

router.post("/posts/:id/reactions", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const emoji = typeof req.body?.emoji === "string" ? req.body.emoji : "";
    const result = await channelService.addReaction(req.authToken!, getSingleParam(req.params.id), emoji);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible d'ajouter la réaction",
    });
  }
});

router.post("/posts/:id/views", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await channelService.recordView(req.authToken!, getSingleParam(req.params.id));
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible d'enregistrer la vue",
    });
  }
});

router.delete("/posts/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await channelService.deletePost(req.authToken!, getSingleParam(req.params.id));
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de supprimer la publication",
    });
  }
});

export default router;

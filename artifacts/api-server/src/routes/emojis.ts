import { Router, type IRouter } from "express";

import { filterEmojiCatalog, getEmoji3dCatalog } from "../lib/emoji-catalog";

const router: IRouter = Router();

router.get("/emojis/3d", async (req, res) => {
  try {
    const catalog = await getEmoji3dCatalog();
    const group = typeof req.query.group === "string" ? req.query.group : undefined;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    res.json(filterEmojiCatalog(catalog, { group, q }));
  } catch (error) {
    res.status(500).json({
      message:
        error instanceof Error ? error.message : "Impossible de charger le catalogue d'émojis",
    });
  }
});

export default router;

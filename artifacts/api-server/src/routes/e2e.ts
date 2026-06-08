import { Router, type IRouter } from "express";
import { z } from "zod";

import {
  getE2ePreKeyBundle,
  isE2eEnabledOnServer,
  listE2eDeviceIds,
  registerE2eDevice,
} from "../lib/e2e-service";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";

const router: IRouter = Router();

const OneTimePreKeySchema = z.object({
  keyId: z.number().int().nonnegative(),
  publicKey: z.string().min(16),
});

const RegisterDeviceBody = z.object({
  deviceId: z.string().min(4).max(128),
  registrationId: z.number().int().positive(),
  identityKeyPublic: z.string().min(16),
  signedPreKeyId: z.number().int().nonnegative(),
  signedPreKeyPublic: z.string().min(16),
  signedPreKeySignature: z.string().min(16),
  oneTimePreKeys: z.array(OneTimePreKeySchema).min(1).max(200),
});

router.post("/e2e/devices", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!isE2eEnabledOnServer()) {
    res.status(503).json({ message: "E2E désactivé sur le serveur" });
    return;
  }

  try {
    const input = RegisterDeviceBody.parse(req.body);
    const result = await registerE2eDevice(req.authUserId!, input);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Enregistrement E2E impossible",
    });
  }
});

router.get("/e2e/prekeys/:userId", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!isE2eEnabledOnServer()) {
    res.status(503).json({ message: "E2E désactivé sur le serveur" });
    return;
  }

  try {
    const userId = req.params.userId;
    if (!userId) {
      res.status(400).json({ message: "userId requis" });
      return;
    }

    const bundle = await getE2ePreKeyBundle(userId);
    if (!bundle) {
      res.status(404).json({ message: "Aucune clé E2E pour cet utilisateur" });
      return;
    }

    res.json(bundle);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de récupérer les clés",
    });
  }
});

router.get("/e2e/devices/:userId", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!isE2eEnabledOnServer()) {
    res.status(503).json({ message: "E2E désactivé sur le serveur" });
    return;
  }

  try {
    const userId = req.params.userId;
    if (!userId) {
      res.status(400).json({ message: "userId requis" });
      return;
    }

    const deviceIds = await listE2eDeviceIds(userId);
    res.json({ userId, deviceIds });
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Impossible de lister les appareils",
    });
  }
});

export default router;

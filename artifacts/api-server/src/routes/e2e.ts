import { Router, type IRouter } from "express";

import {
  getE2ePreKeyBundle,
  isE2eEnabledOnServer,
  listE2eDeviceIds,
  registerE2eDevice,
  type RegisterE2eDeviceInput,
} from "../lib/e2e-service";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

function parseOneTimePreKey(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new Error("oneTimePreKey invalide");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.keyId !== "number" || !Number.isInteger(record.keyId) || record.keyId < 0) {
    throw new Error("oneTimePreKey.keyId invalide");
  }
  if (typeof record.publicKey !== "string" || record.publicKey.trim().length < 16) {
    throw new Error("oneTimePreKey.publicKey invalide");
  }
  return {
    keyId: record.keyId,
    publicKey: record.publicKey.trim(),
  };
}

function parseRegisterDeviceBody(body: unknown): RegisterE2eDeviceInput {
  if (!body || typeof body !== "object") {
    throw new Error("Corps de requête invalide");
  }

  const record = body as Record<string, unknown>;
  if (typeof record.deviceId !== "string" || record.deviceId.trim().length < 4) {
    throw new Error("deviceId requis");
  }
  if (
    typeof record.registrationId !== "number" ||
    !Number.isInteger(record.registrationId) ||
    record.registrationId <= 0
  ) {
    throw new Error("registrationId invalide");
  }
  if (typeof record.identityKeyPublic !== "string" || record.identityKeyPublic.trim().length < 16) {
    throw new Error("identityKeyPublic requis");
  }
  if (
    typeof record.signedPreKeyId !== "number" ||
    !Number.isInteger(record.signedPreKeyId) ||
    record.signedPreKeyId < 0
  ) {
    throw new Error("signedPreKeyId invalide");
  }
  if (
    typeof record.signedPreKeyPublic !== "string" ||
    record.signedPreKeyPublic.trim().length < 16
  ) {
    throw new Error("signedPreKeyPublic requis");
  }
  if (
    typeof record.signedPreKeySignature !== "string" ||
    record.signedPreKeySignature.trim().length < 16
  ) {
    throw new Error("signedPreKeySignature requis");
  }
  if (!Array.isArray(record.oneTimePreKeys) || record.oneTimePreKeys.length === 0) {
    throw new Error("Au moins une oneTimePreKey est requise");
  }
  if (record.oneTimePreKeys.length > 200) {
    throw new Error("Trop de oneTimePreKeys");
  }

  return {
    deviceId: record.deviceId.trim(),
    registrationId: record.registrationId,
    identityKeyPublic: record.identityKeyPublic.trim(),
    signedPreKeyId: record.signedPreKeyId,
    signedPreKeyPublic: record.signedPreKeyPublic.trim(),
    signedPreKeySignature: record.signedPreKeySignature.trim(),
    oneTimePreKeys: record.oneTimePreKeys.map(parseOneTimePreKey),
  };
}

router.post("/e2e/devices", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!isE2eEnabledOnServer()) {
    res.status(503).json({ message: "E2E désactivé sur le serveur" });
    return;
  }

  try {
    const input = parseRegisterDeviceBody(req.body);
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

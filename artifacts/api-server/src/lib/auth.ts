import type { NextFunction, Request, Response } from "express";

import { chatService } from "./chat-service";

export interface AuthenticatedRequest extends Request {
  authToken?: string;
  authUserId?: string;
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.header("authorization");
  const token = header?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    res.status(401).json({ message: "Authentification requise" });
    return;
  }

  void (async () => {
    try {
    req.authToken = token;
      req.authUserId = await chatService.resolveUserIdByToken(token);
      next();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Session invalide ou expirée";
      res.status(401).json({ message });
    }
  })();
}


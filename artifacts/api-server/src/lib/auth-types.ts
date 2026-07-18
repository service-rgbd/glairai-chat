import type { Request } from "express";

export interface AuthenticatedRequest extends Request {
  authToken?: string;
  authUserId?: string;
}

import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../auth/jwt";

export type AuthedRequest = Request & {
  user?: { id: string; email: string; role: string };
};

export function optionalAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) {
    next();
    return;
  }
  try {
    const payload = verifyToken(h.slice(7));
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
  } catch {
    /* ignore */
  }
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = verifyToken(h.slice(7));
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

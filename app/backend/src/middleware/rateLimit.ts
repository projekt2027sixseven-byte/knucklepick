import type { Request } from "express";
import rateLimit from "express-rate-limit";

const testSkip = (): boolean => process.env.NODE_ENV === "test";

function skipHealthAndReady(req: Request): boolean {
  const p = req.path || "";
  return p === "/api/health" || p === "/api/ready";
}

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => testSkip() || skipHealthAndReady(req),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  skip: testSkip,
});

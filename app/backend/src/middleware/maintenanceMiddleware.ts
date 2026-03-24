import type { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { cacheGet, cacheSet } from "../../../utils/cache";
import { loadEnv } from "../../../config/env";

const BYPASS = new Set(["/api/health", "/api/ready"]);

/**
 * 503 for all `/api/*` except health/ready when maintenance is on (env or AppConfig).
 */
export async function maintenanceMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.path.startsWith("/api/") || BYPASS.has(req.path)) {
    next();
    return;
  }
  try {
    if (loadEnv().MAINTENANCE_MODE) {
      res.status(503).json({
        error: "maintenance",
        message: "Knuckle is temporarily unavailable — check back shortly.",
      });
      return;
    }
    const cached = await cacheGet("maintenance:db");
    if (cached === "1") {
      res.status(503).json({
        error: "maintenance",
        message: "Knuckle is temporarily unavailable — check back shortly.",
      });
      return;
    }
    if (cached === "0") {
      next();
      return;
    }
    const row = await prisma.appConfig.findUnique({ where: { key: "MAINTENANCE_MODE" } });
    const on = row?.value === "true";
    await cacheSet("maintenance:db", on ? "1" : "0", 45);
    if (on) {
      res.status(503).json({
        error: "maintenance",
        message: "Knuckle is temporarily unavailable — check back shortly.",
      });
      return;
    }
    next();
  } catch {
    next();
  }
}

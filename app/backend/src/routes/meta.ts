import { Router } from "express";
import { prisma } from "../prisma";
import { cacheGet, cacheSet } from "../../../utils/cache";
import { getDataContextPublic } from "../lib/dataContext";

const router = Router();

/** Non-secret integration posture for trust banners (no DB). */
router.get("/data-context", (_req, res) => {
  res.json(getDataContextPublic());
});

/** Leagues that have at least one upcoming / recent fixture — for dashboard filters. */
router.get("/leagues", async (_req, res) => {
  const cacheKey = "meta:leagues:v1";
  const hit = await cacheGet(cacheKey);
  if (hit) {
    try {
      res.json(JSON.parse(hit) as { leagues: unknown[] });
      return;
    } catch {
      /* fetch fresh */
    }
  }
  const from = new Date(Date.now() - 2 * 86400000);
  const leagues = await prisma.league.findMany({
    where: { matches: { some: { utcDate: { gte: from } } } },
    select: { id: true, name: true, country: true },
    orderBy: { name: "asc" },
  });
  const seen = new Set<string>();
  const deduped = leagues.filter((l) => {
    if (seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });
  const payload = { leagues: deduped };
  await cacheSet(cacheKey, JSON.stringify(payload), 120);
  res.json(payload);
});

export default router;

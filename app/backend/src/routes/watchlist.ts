import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import type { AuthedRequest } from "../middleware/authMiddleware";
import { requireAuth } from "../middleware/authMiddleware";
import { countWatchlist, getUserPlanLimits } from "../services/subscriptionService";

const router = Router();

router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const items = await prisma.watchlistItem.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    include: {
      match: {
        include: {
          homeTeam: true,
          awayTeam: true,
          league: true,
          predictions: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
  res.json({ items });
});

router.post("/", async (req: AuthedRequest, res) => {
  const body = z
    .object({
      matchId: z.string().min(1),
      note: z.string().max(280).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }
  const limits = await getUserPlanLimits(prisma, req.user!.id);
  const used = await countWatchlist(prisma, req.user!.id);
  if (limits.watchlistLimit >= 0 && used >= limits.watchlistLimit) {
    res.status(402).json({ error: "Watchlist capacity reached for your plan", code: "LIMIT" });
    return;
  }
  const match = await prisma.match.findUnique({ where: { id: body.data.matchId } });
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }
  await prisma.watchlistItem.upsert({
    where: { userId_matchId: { userId: req.user!.id, matchId: body.data.matchId } },
    create: {
      userId: req.user!.id,
      matchId: body.data.matchId,
      note: body.data.note,
    },
    update: { note: body.data.note ?? undefined },
  });
  res.json({ ok: true });
});

router.delete("/:matchId", async (req: AuthedRequest, res) => {
  const raw = req.params.matchId;
  const matchId = Array.isArray(raw) ? raw[0] : raw;
  await prisma.watchlistItem.deleteMany({ where: { userId: req.user!.id, matchId } });
  res.json({ ok: true });
});

export default router;

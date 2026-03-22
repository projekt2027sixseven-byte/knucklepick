import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import type { AuthedRequest } from "../middleware/authMiddleware";
import { requireAuth } from "../middleware/authMiddleware";
import { countSavedPicks, getUserPlanLimits } from "../services/subscriptionService";

const router = Router();

router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const picks = await prisma.savedPick.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      match: { include: { homeTeam: true, awayTeam: true, league: true } },
    },
  });
  res.json({ picks });
});

router.post("/", async (req: AuthedRequest, res) => {
  const body = z
    .object({
      matchId: z.string().min(1),
      label: z.string().max(120).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }
  const limits = await getUserPlanLimits(prisma, req.user!.id);
  const used = await countSavedPicks(prisma, req.user!.id);
  if (limits.savedPickLimit >= 0 && used >= limits.savedPickLimit) {
    res.status(402).json({ error: "Saved pick vault is full for your plan", code: "LIMIT" });
    return;
  }
  const match = await prisma.match.findUnique({
    where: { id: body.data.matchId },
    include: { predictions: { orderBy: { createdAt: "desc" }, take: 1 }, odds: { orderBy: { fetchedAt: "desc" }, take: 1 } },
  });
  if (!match || !match.predictions[0]) {
    res.status(404).json({ error: "Match or prediction not found" });
    return;
  }
  const p = match.predictions[0];
  const o = match.odds[0];
  const snapshot = {
    savedAt: new Date().toISOString(),
    outcome: p.outcomePrediction,
    confidence: p.confidence,
    exactScore: p.exactScore,
    trustIndex: p.trustIndex,
    odds: o ? { home: o.homeOdds, draw: o.drawOdds, away: o.awayOdds } : null,
  };
  const pick = await prisma.savedPick.create({
    data: {
      userId: req.user!.id,
      matchId: body.data.matchId,
      label: body.data.label,
      snapshot,
    },
  });
  res.json({ pick });
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await prisma.savedPick.deleteMany({ where: { id, userId: req.user!.id } });
  res.json({ ok: true });
});

export default router;

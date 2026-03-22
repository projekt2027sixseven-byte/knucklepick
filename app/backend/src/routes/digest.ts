import { Router } from "express";
import { prisma } from "../prisma";
import type { AuthedRequest } from "../middleware/authMiddleware";
import { requireAuth } from "../middleware/authMiddleware";
import { buildDailyDigest } from "../../../services/digestService";
import { getUserPlanLimits } from "../services/subscriptionService";

const router = Router();

router.get("/today", requireAuth, async (req: AuthedRequest, res) => {
  const limits = await getUserPlanLimits(prisma, req.user!.id);
  const prefs = await prisma.userPreferences.findUnique({ where: { userId: req.user!.id } });
  if (!limits.digestEnabled || !prefs?.digestEnabled) {
    res.status(402).json({ error: "Enable digest in preferences on a Pro+ plan", code: "PLAN" });
    return;
  }
  const digest = await buildDailyDigest(prisma);
  res.json(digest);
});

export default router;

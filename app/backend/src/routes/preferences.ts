import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import type { AuthedRequest } from "../middleware/authMiddleware";
import { requireAuth } from "../middleware/authMiddleware";
import { getUserPlanLimits } from "../services/subscriptionService";

const router = Router();

router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  let prefs = await prisma.userPreferences.findUnique({ where: { userId: req.user!.id } });
  if (!prefs) {
    prefs = await prisma.userPreferences.create({ data: { userId: req.user!.id } });
  }
  const limits = await getUserPlanLimits(prisma, req.user!.id);
  res.json({
    preferences: prefs,
    entitlements: limits,
  });
});

router.put("/", async (req: AuthedRequest, res) => {
  const body = z
    .object({
      digestEnabled: z.boolean().optional(),
      digestHourUtc: z.number().int().min(0).max(23).optional(),
      favoriteLeagueIds: z.array(z.string()).max(32).optional(),
      reducedMotion: z.boolean().optional(),
      onboardingStep: z.number().int().min(0).max(5).optional(),
      onboardingCompleted: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }
  const limits = await getUserPlanLimits(prisma, req.user!.id);
  if (body.data.digestEnabled && !limits.digestEnabled) {
    res.status(402).json({ error: "Digest is not included in your plan", code: "PLAN" });
    return;
  }

  const data: Record<string, unknown> = {};
  if (body.data.digestHourUtc !== undefined) data.digestHourUtc = body.data.digestHourUtc;
  if (body.data.favoriteLeagueIds) data.favoriteLeagueIds = body.data.favoriteLeagueIds;
  if (body.data.reducedMotion !== undefined) data.reducedMotion = body.data.reducedMotion;
  if (body.data.onboardingStep !== undefined) data.onboardingStep = body.data.onboardingStep;
  if (body.data.digestEnabled !== undefined) data.digestEnabled = body.data.digestEnabled;
  if (body.data.onboardingCompleted) {
    data.onboardingCompletedAt = new Date();
    data.onboardingStep = 5;
  }

  const prefs = await prisma.userPreferences.upsert({
    where: { userId: req.user!.id },
    create: { userId: req.user!.id, ...(data as object) },
    update: data,
  });
  res.json({ preferences: prefs });
});

export default router;

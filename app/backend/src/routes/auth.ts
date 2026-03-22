import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { signToken } from "../auth/jwt";
import type { AuthedRequest } from "../middleware/authMiddleware";
import { requireAuth } from "../middleware/authMiddleware";
import { authLimiter } from "../middleware/rateLimit";
import {
  countMatchViewsToday,
  countSavedPicks,
  countWatchlist,
  getUserPlanLimits,
} from "../services/subscriptionService";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/register", authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password, name } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const starter = await prisma.plan.findUnique({ where: { slug: "starter" } });
  if (!starter) {
    res.status(500).json({ error: "Plans not seeded" });
    return;
  }
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      subscription: {
        create: {
          planId: starter.id,
          status: "ACTIVE",
        },
      },
      preferences: { create: {} },
    },
  });
  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.post("/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user?.passwordHash) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { subscription: { include: { plan: true } }, preferences: true },
  });
  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const entitlements = await getUserPlanLimits(prisma, user.id);
  const since = new Date(Date.now() - 7 * 86400000);
  const activity7d = await prisma.usageLog.count({
    where: { userId: user.id, createdAt: { gte: since } },
  });
  const watchlistCount = await countWatchlist(prisma, user.id);
  const savedOpen = await countSavedPicks(prisma, user.id);
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    preferences: user.preferences,
    entitlements,
    engagement: {
      signals7d: activity7d,
      watchlistCount,
      openSavedPicks: savedOpen,
      viewsToday: await countMatchViewsToday(prisma, user.id),
    },
    subscription: user.subscription
      ? {
          status: user.subscription.status,
          plan: user.subscription.plan,
          currentPeriodEnd: user.subscription.currentPeriodEnd,
        }
      : null,
  });
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import type { AuthedRequest } from "../middleware/authMiddleware";
import { optionalAuth, requireAuth } from "../middleware/authMiddleware";
import {
  countMatchViewsToday,
  getUserPlanLimits,
  logMatchView,
  shouldLockPremium,
} from "../services/subscriptionService";
import { cacheGet, cacheSet } from "../../../utils/cache";

const router = Router();

function stripPremium(pred: Record<string, unknown>): Record<string, unknown> {
  const clone = { ...pred };
  delete clone.similarityStats;
  delete clone.scenarios;
  delete clone.factors;
  delete clone.valueScore;
  delete clone.marketAlignmentScore;
  delete clone.methodology;
  delete clone.probHome;
  delete clone.probDraw;
  delete clone.probAway;
  delete clone.calibratedHome;
  delete clone.calibratedDraw;
  delete clone.calibratedAway;
  delete clone.goalsBandLow;
  delete clone.goalsBandHigh;
  delete clone.trustIndex;
  const reasoning = clone.reasoning;
  return {
    ...clone,
    reasoning: typeof reasoning === "string" ? reasoning.slice(0, 200) + "…" : reasoning,
    premiumLocked: true,
  };
}

router.get("/", optionalAuth, async (req: AuthedRequest, res) => {
  const q = z
    .object({
      from: z.string().datetime().optional(),
      leagueId: z.string().optional(),
    })
    .safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.flatten() });
    return;
  }
  const from = q.data.from ? new Date(q.data.from) : new Date(Date.now() - 2 * 86400000);
  const cacheKey = `dash:v3:${from.toISOString()}:${q.data.leagueId ?? "all"}:${req.user?.id ?? "anon"}`;
  const hit = await cacheGet(cacheKey);
  if (hit) {
    try {
      res.json(JSON.parse(hit));
      return;
    } catch {
      /* invalid cache entry — fetch fresh */
    }
  }

  const matches = await prisma.match.findMany({
    where: {
      utcDate: { gte: from },
      ...(q.data.leagueId ? { leagueId: q.data.leagueId } : {}),
    },
    orderBy: { utcDate: "asc" },
    take: 200,
    include: {
      homeTeam: true,
      awayTeam: true,
      league: true,
      predictions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  let watched = new Set<string>();
  if (req.user) {
    const wl = await prisma.watchlistItem.findMany({
      where: { userId: req.user.id },
      select: { matchId: true },
    });
    watched = new Set(wl.map((w) => w.matchId));
  }

  const enriched = matches.map((m) => {
    const p = m.predictions[0];
    return {
      id: m.id,
      externalId: m.externalId,
      utcDate: m.utcDate,
      status: m.status,
      oddsFetchedAt: m.oddsFetchedAt,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      league: m.league,
      isWatched: watched.has(m.id),
      prediction: p
        ? {
            outcomePrediction: p.outcomePrediction,
            confidence: p.confidence,
            exactScore: p.exactScore,
            valueScore: p.valueScore,
            riskLevel: p.riskLevel,
            noBet: p.noBet,
            trapMatch: p.trapMatch,
            trustIndex: p.trustIndex,
            probHome: p.probHome,
            probDraw: p.probDraw,
            probAway: p.probAway,
          }
        : null,
    };
  });

  const topPicks = [...enriched]
    .filter((x) => x.prediction && !x.prediction.noBet)
    .sort((a, b) => (b.prediction?.trustIndex ?? 0) - (a.prediction?.trustIndex ?? 0))
    .slice(0, 8);

  const valueBets = [...enriched]
    .filter((x) => x.prediction && (x.prediction.valueScore ?? 0) > 0.04)
    .sort((a, b) => (b.prediction?.valueScore ?? 0) - (a.prediction?.valueScore ?? 0))
    .slice(0, 8);

  const traps = enriched.filter((x) => x.prediction?.trapMatch).slice(0, 8);

  const payload = { matches: enriched, topPicks, valueBets, traps };
  await cacheSet(cacheKey, JSON.stringify(payload), 90);
  res.json(payload);
});

router.get("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
      league: true,
      odds: { orderBy: { fetchedAt: "desc" }, take: 3 },
      stats: true,
      predictions: { orderBy: { createdAt: "desc" }, take: 1, include: { factors: true } },
      similarityCases: { orderBy: { similarity: "desc" }, take: 12 },
    },
  });
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const pred = match.predictions[0];
  if (!pred) {
    res.json({ match, prediction: null });
    return;
  }

  const limits = await getUserPlanLimits(prisma, req.user!.id);
  const used = await countMatchViewsToday(prisma, req.user!.id);
  const lock = shouldLockPremium(limits.dailyMatchLimit, used);

  if (!lock) {
    await logMatchView(prisma, req.user!.id, match.id);
  }

  const full = {
    ...pred,
    factors: pred.factors,
  } as unknown as Record<string, unknown>;

  res.json({
    match: {
      id: match.id,
      utcDate: match.utcDate,
      status: match.status,
      oddsFetchedAt: match.oddsFetchedAt,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      league: match.league,
      odds: match.odds,
      stats: match.stats,
      similarityCases: match.similarityCases,
    },
    prediction: lock ? stripPremium(full) : full,
    usage: {
      planSlug: limits.planSlug,
      dailyLimit: limits.dailyMatchLimit,
      viewsToday: used,
      premiumLocked: lock,
      watchlistLimit: limits.watchlistLimit,
      savedPickLimit: limits.savedPickLimit,
      digestEnabled: limits.digestEnabled,
      apiAccess: limits.apiAccess,
    },
  });
});

export default router;

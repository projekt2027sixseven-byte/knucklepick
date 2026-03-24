import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import type { AuthedRequest } from "../middleware/authMiddleware";
import { optionalAuth } from "../middleware/authMiddleware";
import {
  countMatchViewsToday,
  getUserPlanLimits,
  logMatchView,
  shouldLockPremium,
} from "../services/subscriptionService";
import { cacheGet, cacheSet } from "../../../utils/cache";
import { compareEdgeRank, computeEdgeDetection } from "../../../engines/edgeDetection";
import {
  LOW_CONFIDENCE_THRESHOLD,
  MIN_EDGE_ON_PICK_VALUE,
  TOP_EDGES_DECISION_COUNT,
  TRAP_BRIEF_DEFAULT,
} from "../../../constants/edge";
import { resourceIdSchema } from "../validation/ids";
import { getDataContextPublic } from "../lib/dataContext";
import { getMatchTrackContext } from "../../../services/predictionSettlement";

const router = Router();

type OddsRow = { homeOdds: number; drawOdds: number; awayOdds: number; bookmaker?: string | null };

function stripPremium(pred: Record<string, unknown>): Record<string, unknown> {
  const clone = { ...pred };
  delete clone.similarityStats;
  delete clone.scenarios;
  delete clone.factors;
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
  const fromDefault = new Date();
  fromDefault.setUTCHours(0, 0, 0, 0);
  fromDefault.setUTCDate(fromDefault.getUTCDate() - 1);
  const from = q.data.from ? new Date(q.data.from) : fromDefault;
  const cacheKey = `dash:v12:${from.toISOString()}:${q.data.leagueId ?? "all"}:${req.user?.id ?? "anon"}`;
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
      odds: { orderBy: { fetchedAt: "desc" }, take: 1 },
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
    const o = m.odds?.[0];
    let prediction: Record<string, unknown> | null = null;
    if (p) {
      const oddsRow: OddsRow | null = o
        ? { homeOdds: o.homeOdds, drawOdds: o.drawOdds, awayOdds: o.awayOdds, bookmaker: o.bookmaker ?? undefined }
        : null;
      const edgeBase = {
        outcomePrediction: p.outcomePrediction,
        confidence: p.confidence,
        exactScore: p.exactScore,
        valueScore: p.valueScore,
        edgeMaxPct: p.valueScore * 100,
        riskLevel: p.riskLevel,
        noBet: p.noBet,
        trapMatch: p.trapMatch,
        trapBrief: p.trapMatch ? TRAP_BRIEF_DEFAULT : null,
        trustIndex: p.trustIndex,
        probHome: p.probHome,
        probDraw: p.probDraw,
        probAway: p.probAway,
        mockContext: p.mockContext,
        oddsMatchScore: p.oddsMatchScore,
        updatedAt: p.createdAt.toISOString(),
        engineRunAt: p.createdAt.toISOString(),
        confidenceDeltaPrev: p.confidenceDeltaPrev,
        edgeOnPickPctDeltaPrev: p.edgeOnPickPctDeltaPrev,
        maxEdgeProbDeltaPrev: p.maxEdgeProbDeltaPrev,
      };
      if (oddsRow) {
        const ed = computeEdgeDetection(
          oddsRow.homeOdds,
          oddsRow.drawOdds,
          oddsRow.awayOdds,
          p.calibratedHome,
          p.calibratedDraw,
          p.calibratedAway,
          p.probHome,
          p.probDraw,
          p.probAway,
          p.outcomePrediction,
          p.confidence,
          p.trustIndex,
          p.noBet
        );
        prediction = {
          ...edgeBase,
          marketImpliedHome: ed.marketImplied.home,
          marketImpliedDraw: ed.marketImplied.draw,
          marketImpliedAway: ed.marketImplied.away,
          edgePctHome: ed.edgePctHome,
          edgePctDraw: ed.edgePctDraw,
          edgePctAway: ed.edgePctAway,
          edgeOnPick: ed.edgeOnDisplayedPickPct / 100,
          edgeOnPickPct: ed.edgeOnDisplayedPickPct,
          maxEdgeProb: ed.maxEdgeProb,
          edgeLabel: ed.edgeLabel,
          strongSignal: ed.strongSignal,
          surfaceEligible: ed.surfaceEligible,
        };
      } else {
        prediction = {
          ...edgeBase,
          edgeOnPick: null,
          edgeOnPickPct: null,
          maxEdgeProb: null,
          edgeLabel: "NO_EDGE",
          strongSignal: false,
          surfaceEligible: false,
        };
      }
    }
    const createdMs = new Date(m.createdAt).getTime();
    const isNewFixture = Number.isFinite(createdMs) && Date.now() - createdMs < 48 * 3600000;

    return {
      id: m.id,
      externalId: m.externalId,
      utcDate: m.utcDate,
      status: m.status,
      oddsFetchedAt: m.oddsFetchedAt,
      matchCreatedAt: m.createdAt.toISOString(),
      isNewFixture,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      league: m.league,
      predictionEligibility: m.predictionEligibility,
      insufficientDataReason: m.insufficientDataReason,
      reliabilityFlags: m.reliabilityFlags ?? [],
      isWatched: watched.has(m.id),
      odds: o
        ? {
            homeOdds: o.homeOdds,
            drawOdds: o.drawOdds,
            awayOdds: o.awayOdds,
            bookmaker: o.bookmaker,
          }
        : null,
      prediction,
    };
  });

  /** Selective rails: MEDIUM/HIGH edge + strong signal (confidence + trust), excluding demo odds. */
  const edgePool = [...enriched]
    .filter((x) => {
      const pr = x.prediction as { surfaceEligible?: boolean; mockContext?: boolean } | null;
      return Boolean(pr?.surfaceEligible && !pr.mockContext);
    })
    .sort((a, b) =>
      compareEdgeRank(
        a.prediction as { maxEdgeProb?: number; confidence?: number; trustIndex?: number },
        b.prediction as { maxEdgeProb?: number; confidence?: number; trustIndex?: number }
      )
    );

  const topEdges = edgePool.slice(0, TOP_EDGES_DECISION_COUNT);
  const topEdgeIds = new Set(topEdges.map((x) => x.id));

  const valuePicks = [...enriched]
    .filter((x) => {
      const pr = x.prediction as {
        surfaceEligible?: boolean;
        mockContext?: boolean;
        maxEdgeProb?: number | null;
      } | null;
      return (
        pr &&
        pr.surfaceEligible &&
        !pr.mockContext &&
        pr.maxEdgeProb != null &&
        pr.maxEdgeProb >= MIN_EDGE_ON_PICK_VALUE &&
        !topEdgeIds.has(x.id)
      );
    })
    .sort((a, b) =>
      compareEdgeRank(
        a.prediction as { maxEdgeProb?: number; confidence?: number; trustIndex?: number },
        b.prediction as { maxEdgeProb?: number; confidence?: number; trustIndex?: number }
      )
    )
    .slice(0, 8);

  const traps = enriched.filter((x) => (x.prediction as { trapMatch?: boolean } | null)?.trapMatch).slice(0, 8);

  const decisionRailIds = new Set([...topEdges, ...valuePicks, ...traps].map((x) => x.id));
  const avoidWeak = [...enriched]
    .filter((x) => {
      const pr = x.prediction as { noBet?: boolean; confidence?: number } | null;
      if (!pr || decisionRailIds.has(x.id)) return false;
      return pr.noBet || (pr.confidence ?? 1) < LOW_CONFIDENCE_THRESHOLD;
    })
    .sort((a, b) => {
      const pa = a.prediction as { noBet?: boolean; confidence?: number };
      const pb = b.prediction as { noBet?: boolean; confidence?: number };
      if (pa.noBet !== pb.noBet) return pa.noBet ? -1 : 1;
      return (pa.confidence ?? 1) - (pb.confidence ?? 1);
    })
    .slice(0, 12);

  const featuredIds = new Set([...topEdges, ...valuePicks, ...traps].map((x) => x.id));
  const recentlyUpdated = [...enriched]
    .filter((x) => x.prediction != null && !featuredIds.has(x.id))
    .sort((a, b) => {
      const pa = a.prediction as {
        edgeOnPickPctDeltaPrev?: number | null;
        confidenceDeltaPrev?: number | null;
        engineRunAt?: string;
      };
      const pb = b.prediction as typeof pa;
      const sa =
        Math.abs(pa.edgeOnPickPctDeltaPrev ?? 0) * 2 + Math.abs(pa.confidenceDeltaPrev ?? 0) * 100;
      const sb =
        Math.abs(pb.edgeOnPickPctDeltaPrev ?? 0) * 2 + Math.abs(pb.confidenceDeltaPrev ?? 0) * 100;
      if (sb !== sa) return sb - sa;
      const ta = new Date(pa.engineRunAt ?? 0).getTime();
      const tb = new Date(pb.engineRunAt ?? 0).getTime();
      return tb - ta;
    })
    .slice(0, 12);

  const payload = {
    dataContext: getDataContextPublic(),
    matches: enriched,
    topEdges,
    valuePicks,
    traps,
    avoidWeak,
    recentlyUpdated,
  };
  await cacheSet(cacheKey, JSON.stringify(payload), 90);
  res.json(payload);
});

router.get("/:id", optionalAuth, async (req: AuthedRequest, res) => {
  const idParse = resourceIdSchema.safeParse(req.params.id);
  if (!idParse.success) {
    res.status(400).json({ error: "Invalid match id" });
    return;
  }
  const id = idParse.data;
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
    res.json({
      match: {
        id: match.id,
        utcDate: match.utcDate,
        status: match.status,
        oddsFetchedAt: match.oddsFetchedAt,
        predictionEligibility: match.predictionEligibility,
        insufficientDataReason: match.insufficientDataReason,
        reliabilityFlags: match.reliabilityFlags ?? [],
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        league: match.league,
        odds: match.odds,
        stats: match.stats,
        similarityCases: match.similarityCases,
      },
      prediction: null,
      matchTrackContext: null,
      usage: null,
    });
    return;
  }

  const matchTrackContext = await getMatchTrackContext(prisma, pred.confidence, pred.mockContext);

  const o0 = match.odds[0];
  const edgeExtras =
    o0 != null
      ? (() => {
          const ed = computeEdgeDetection(
            o0.homeOdds,
            o0.drawOdds,
            o0.awayOdds,
            pred.calibratedHome,
            pred.calibratedDraw,
            pred.calibratedAway,
            pred.probHome,
            pred.probDraw,
            pred.probAway,
            pred.outcomePrediction,
            pred.confidence,
            pred.trustIndex,
            pred.noBet
          );
          return {
            marketImpliedHome: ed.marketImplied.home,
            marketImpliedDraw: ed.marketImplied.draw,
            marketImpliedAway: ed.marketImplied.away,
            edgePctHome: ed.edgePctHome,
            edgePctDraw: ed.edgePctDraw,
            edgePctAway: ed.edgePctAway,
            edgeOnPick: ed.edgeOnDisplayedPickPct / 100,
            edgeOnPickPct: ed.edgeOnDisplayedPickPct,
            edgeMaxPct: pred.valueScore * 100,
            maxEdgeProb: ed.maxEdgeProb,
            edgeLabel: ed.edgeLabel,
            strongSignal: ed.strongSignal,
            surfaceEligible: ed.surfaceEligible,
            trapBrief: pred.trapMatch ? TRAP_BRIEF_DEFAULT : null,
          };
        })()
      : {
          edgeOnPick: null as number | null,
          edgeOnPickPct: null as number | null,
          edgeMaxPct: pred.valueScore * 100,
          maxEdgeProb: null as number | null,
          edgeLabel: "NO_EDGE" as const,
          strongSignal: false,
          surfaceEligible: false,
          trapBrief: pred.trapMatch ? TRAP_BRIEF_DEFAULT : null,
        };

  const full = {
    ...pred,
    factors: pred.factors,
    ...edgeExtras,
  } as unknown as Record<string, unknown>;

  if (!req.user) {
    res.json({
      match: {
        id: match.id,
        utcDate: match.utcDate,
        status: match.status,
        oddsFetchedAt: match.oddsFetchedAt,
        predictionEligibility: match.predictionEligibility,
        insufficientDataReason: match.insufficientDataReason,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        league: match.league,
        odds: match.odds,
        stats: match.stats,
        similarityCases: match.similarityCases,
      },
      prediction: stripPremium(full),
      usage: null,
    });
    return;
  }

  const limits = await getUserPlanLimits(prisma, req.user.id);
  const used = await countMatchViewsToday(prisma, req.user.id);
  const lock = shouldLockPremium(limits.dailyMatchLimit, used);

  if (!lock) {
    await logMatchView(prisma, req.user.id, match.id);
  }

  res.json({
    match: {
      id: match.id,
      utcDate: match.utcDate,
      status: match.status,
      oddsFetchedAt: match.oddsFetchedAt,
      predictionEligibility: match.predictionEligibility,
      insufficientDataReason: match.insufficientDataReason,
      reliabilityFlags: match.reliabilityFlags ?? [],
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      league: match.league,
      odds: match.odds,
      stats: match.stats,
      similarityCases: match.similarityCases,
    },
    prediction: lock ? stripPremium(full) : full,
    matchTrackContext,
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

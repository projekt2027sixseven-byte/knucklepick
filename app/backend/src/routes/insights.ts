import { Router } from "express";
import { prisma } from "../prisma";
import { MODEL_VERSION, PRODUCT_NAME, PRODUCT_TAGLINE } from "../../../constants/product";
import { computePlatformPerformance } from "../../../services/predictionSettlement";

const router = Router();

router.get("/performance", async (_req, res) => {
  try {
    const data = await computePlatformPerformance(prisma);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "performance_failed" });
  }
});

router.get("/platform", async (_req, res) => {
  const lastPred = await prisma.prediction.findFirst({ orderBy: { createdAt: "desc" } });
  const matchCount = await prisma.match.count({ where: { utcDate: { gte: new Date(Date.now() - 48 * 3600000) } } });
  res.json({
    product: PRODUCT_NAME,
    tagline: PRODUCT_TAGLINE,
    modelVersion: MODEL_VERSION,
    lastModelRun: lastPred?.createdAt?.toISOString() ?? null,
    fixturesIndexed48h: matchCount,
    pillars: [
      "Multi-layer stack: Poisson score lattice, market-implied priors, and empirical λ blending from finished matches.",
      "Odds-structure similarity (not same-team replay): cohorts matched on implied 1X2 shape, form gap, and scoring environment.",
      "Calibration + trust: shrinkage toward the market when data is thin; explicit NO BET when signals conflict.",
      "Market vs model: edge scoring with noise floors — we do not treat microscopic differences as signal.",
      "Ex-post validation: every real-odds prediction is settled against full-time results; public track record excludes demo/synthetic fixtures.",
      "Retention-grade workflows: watchlists, vault snapshots, digest hooks, and plan-aware metering.",
    ],
    disclaimers: [
      "Knuckle surfaces probabilistic estimates for research and entertainment — never financial advice.",
      "Markets can incorporate non-public information; always verify with licensed professionals in your jurisdiction.",
    ],
  });
});

export default router;

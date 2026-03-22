import { Router } from "express";
import { prisma } from "../prisma";
import { MODEL_VERSION, PRODUCT_NAME, PRODUCT_TAGLINE } from "../../../constants/product";

const router = Router();

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
      "Transparent probabilities with market calibration, not black-box vibes.",
      "Historical odds similarity cohorts to stress-test tail scenarios.",
      "Poisson lattice + form/xG fusion with explicit NO BET governance.",
      "Operational telemetry: data freshness stamps, trust index, volatility radar.",
    ],
    disclaimers: [
      "Oracle Pitch surfaces probabilistic estimates for research and entertainment — never financial advice.",
      "Markets can incorporate non-public information; always verify with licensed professionals in your jurisdiction.",
    ],
  });
});

export default router;

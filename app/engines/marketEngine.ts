import { impliedProbabilities } from "../utils/math";
import { modelMarketDisagreement } from "./uncertaintyEngine";

export type MarketAlignment = {
  marketProbHome: number;
  marketProbDraw: number;
  marketProbAway: number;
  modelProbHome: number;
  modelProbDraw: number;
  modelProbAway: number;
  /** Max raw edge on any outcome (model − market). */
  valueScore: number;
  valueSide: "HOME" | "DRAW" | "AWAY" | "NONE";
  overpricedFavorite: boolean;
  alignmentScore: number;
  /** L1 distance between model and market 1X2. */
  disagreementL1: number;
  /** Normalized edge strength after accounting for “minimum meaningful” threshold. */
  edgeScore: number;
  /** True only if at least one side clears noise + minimum edge floor. */
  meaningfulEdge: boolean;
  /** How actionable the largest edge is after noise / thresholds. */
  edgeQuality: "STRONG" | "MODERATE" | "WEAK" | "NONE";
};

const NOISE_FLOOR = 0.018;
const MEANINGFUL_EDGE_DELTA = 0.015;

export function analyzeMarketVsModel(
  homeOdds: number,
  drawOdds: number,
  awayOdds: number,
  model: { pHome: number; pDraw: number; pAway: number }
): MarketAlignment {
  const mkt = impliedProbabilities(homeOdds, drawOdds, awayOdds);
  const edges = [model.pHome - mkt.home, model.pDraw - mkt.draw, model.pAway - mkt.away];
  const maxEdge = Math.max(...edges);
  const idx = edges.indexOf(maxEdge);
  const side: MarketAlignment["valueSide"] =
    maxEdge > NOISE_FLOOR ? (idx === 0 ? "HOME" : idx === 1 ? "DRAW" : "AWAY") : "NONE";

  const favIdx = [mkt.home, mkt.draw, mkt.away].indexOf(Math.max(mkt.home, mkt.draw, mkt.away));
  const modelFavProb = [model.pHome, model.pDraw, model.pAway][favIdx]!;
  const mktFavProb = [mkt.home, mkt.draw, mkt.away][favIdx]!;
  const overpricedFavorite = mktFavProb > 0.45 && modelFavProb + 0.08 < mktFavProb;

  const disagreementL1 = modelMarketDisagreement(model, mkt);

  const alignmentScore =
    100 *
    (1 -
      (Math.abs(model.pHome - mkt.home) +
        Math.abs(model.pDraw - mkt.draw) +
        Math.abs(model.pAway - mkt.away)) /
        2);

  const meaningfulEdge = maxEdge > NOISE_FLOOR + MEANINGFUL_EDGE_DELTA;
  const edgeScore = meaningfulEdge ? maxEdge : maxEdge * 0.32;
  let edgeQuality: MarketAlignment["edgeQuality"] = "NONE";
  if (maxEdge > NOISE_FLOOR + 0.045) edgeQuality = "STRONG";
  else if (meaningfulEdge) edgeQuality = "MODERATE";
  else if (maxEdge > NOISE_FLOOR + 0.006) edgeQuality = "WEAK";

  return {
    marketProbHome: mkt.home,
    marketProbDraw: mkt.draw,
    marketProbAway: mkt.away,
    modelProbHome: model.pHome,
    modelProbDraw: model.pDraw,
    modelProbAway: model.pAway,
    valueScore: maxEdge,
    valueSide: side,
    overpricedFavorite,
    alignmentScore: Math.max(0, Math.min(100, alignmentScore)),
    disagreementL1,
    edgeScore,
    meaningfulEdge,
    edgeQuality,
  };
}

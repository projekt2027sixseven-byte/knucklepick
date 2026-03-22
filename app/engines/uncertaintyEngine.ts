import { clamp } from "../utils/math";

export type UncertaintyBreakdown = {
  /** 0 = very uncertain, 1 = relatively settled */
  epistemic: number;
  /** Model–market L1 distance on 1X2 */
  disagreement: number;
  /** Composite 0–100, higher = more uncertain */
  uncertaintyIndex: number;
};

export function modelMarketDisagreement(
  model: { pHome: number; pDraw: number; pAway: number },
  market: { home: number; draw: number; away: number }
): number {
  return (
    Math.abs(model.pHome - market.home) +
    Math.abs(model.pDraw - market.draw) +
    Math.abs(model.pAway - market.away)
  );
}

export function uncertaintyIndex(params: {
  volatilityScore: number;
  dataQualityScore: number;
  similarityScore: number;
  disagreementL1: number;
}): UncertaintyBreakdown {
  const volN = params.volatilityScore / 100;
  const dqN = 1 - params.dataQualityScore / 100;
  const simN = 1 - params.similarityScore / 100;
  const disagreeN = clamp(params.disagreementL1 / 1.2, 0, 1);
  const epistemic = clamp(1 - (0.35 * volN + 0.35 * dqN + 0.3 * simN), 0, 1);
  const uncertaintyIndex = clamp(
    42 * volN + 28 * dqN + 18 * simN + 12 * disagreeN,
    8,
    96
  );
  return {
    epistemic,
    disagreement: params.disagreementL1,
    uncertaintyIndex,
  };
}

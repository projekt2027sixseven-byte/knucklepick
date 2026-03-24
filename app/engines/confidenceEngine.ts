import { clamp } from "../utils/math";

export type ConfidenceInputs = {
  dataQualityScore: number;
  marketAlignmentScore: number;
  similarityScore: number;
  volatilityScore: number;
  modelSpread: number;
  /** 0–100, higher = more uncertain (from uncertaintyEngine). */
  uncertaintyIndex: number;
  /** max(p) − second(p) on the working 1X2 triplet — tight races should not read as “high conviction”. */
  probMargin?: number;
  /** L1(model vs market) on 1X2 — large disagreement caps usable confidence. */
  disagreementL1?: number;
};

export function compositeConfidence(input: ConfidenceInputs): {
  confidence: number;
  modelConfidence: number;
} {
  const u = input.uncertaintyIndex / 100;
  const pm = input.probMargin ?? 0.12;
  const d1 = input.disagreementL1 ?? 0.25;
  const marginPenalty = pm < 0.052 ? 0.14 : pm < 0.07 ? 0.08 : pm < 0.095 ? 0.04 : 0;
  const disagreePenalty = d1 > 0.52 ? 0.12 : d1 > 0.4 ? 0.07 : d1 > 0.32 ? 0.03 : 0;

  const modelConfidence = clamp(
    (0.41 * (input.dataQualityScore / 100) +
      0.22 * (input.similarityScore / 100) +
      0.19 * (1 - input.volatilityScore / 100) +
      0.1 * (input.modelSpread / 100) +
      0.08 * (1 - u)) *
      (1 - marginPenalty) *
      (1 - disagreePenalty),
    0,
    0.82
  );
  const confidence = clamp(
    (0.3 * modelConfidence +
      0.33 * (input.marketAlignmentScore / 100) +
      0.27 * (input.similarityScore / 100) +
      0.1 * (1 - u)) *
      (1 - marginPenalty * 0.95) *
      (1 - disagreePenalty * 0.9),
    0,
    0.78
  );
  return { confidence, modelConfidence };
}

export function dataQualityFromInputs(hasOdds: boolean, hasStats: boolean, mock: boolean): number {
  let q = 0.38;
  if (hasOdds) q += 0.28;
  if (hasStats) q += 0.27;
  if (!mock) q += 0.07;
  return clamp(q, 0, 1) * 100;
}

export function volatilityFromProbs(pHome: number, pDraw: number, pAway: number): number {
  const maxp = Math.max(pHome, pDraw, pAway);
  const entropy = -(
    pHome * Math.log(pHome + 1e-9) +
    pDraw * Math.log(pDraw + 1e-9) +
    pAway * Math.log(pAway + 1e-9)
  );
  const normEnt = entropy / Math.log(3);
  const vol = (1 - maxp) * 55 + normEnt * 45;
  return clamp(vol, 0, 100);
}

import { clamp } from "../utils/math";

export type ConfidenceInputs = {
  dataQualityScore: number;
  marketAlignmentScore: number;
  similarityScore: number;
  volatilityScore: number;
  modelSpread: number;
  /** 0–100, higher = more uncertain (from uncertaintyEngine). */
  uncertaintyIndex: number;
};

export function compositeConfidence(input: ConfidenceInputs): {
  confidence: number;
  modelConfidence: number;
} {
  const u = input.uncertaintyIndex / 100;
  const modelConfidence = clamp(
    0.42 * (input.dataQualityScore / 100) +
      0.22 * (input.similarityScore / 100) +
      0.18 * (1 - input.volatilityScore / 100) +
      0.1 * (input.modelSpread / 100) +
      0.08 * (1 - u),
    0,
    1
  );
  const confidence = clamp(
    0.32 * modelConfidence +
      0.34 * (input.marketAlignmentScore / 100) +
      0.26 * (input.similarityScore / 100) +
      0.08 * (1 - u),
    0,
    1
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

import { clamp } from "../utils/math";

export type CalibrationContext = {
  dataQuality01: number;
  volatility01: number;
  mockData: boolean;
  similarity01: number;
};

/**
 * Market-aware shrinkage: pull model toward implied prices more when epistemic uncertainty is high.
 * Returns α in [0,1] = weight on **model** (remainder on market).
 */
export function adaptiveShrinkage(ctx: CalibrationContext): number {
  const base = 0.62;
  const dq = (1 - ctx.dataQuality01) * 0.14;
  const vol = ctx.volatility01 * 0.1;
  const sim = (1 - ctx.similarity01) * 0.06;
  let alpha = base - dq - vol - sim;
  if (ctx.mockData) alpha -= 0.12;
  return clamp(alpha, 0.28, 0.82);
}

export function calibrateTriplet(
  model: { pHome: number; pDraw: number; pAway: number },
  market: { home: number; draw: number; away: number },
  shrink: number
): { cHome: number; cDraw: number; cAway: number } {
  const cHome = (1 - shrink) * model.pHome + shrink * market.home;
  const cDraw = (1 - shrink) * model.pDraw + shrink * market.draw;
  const cAway = (1 - shrink) * model.pAway + shrink * market.away;
  const s = cHome + cDraw + cAway;
  return { cHome: cHome / s, cDraw: cDraw / s, cAway: cAway / s };
}

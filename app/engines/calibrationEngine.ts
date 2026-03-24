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
  /** Lower α ⇒ more weight on market (1−α) — reduces overconfidence on sparse signals. */
  const base = 0.52;
  const dq = (1 - ctx.dataQuality01) * 0.16;
  const vol = ctx.volatility01 * 0.12;
  const sim = (1 - ctx.similarity01) * 0.08;
  let alpha = base - dq - vol - sim;
  if (ctx.mockData) alpha -= 0.14;
  return clamp(alpha, 0.22, 0.78);
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

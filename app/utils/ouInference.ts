import { clamp, poissonPmf } from "./math";

/**
 * De-vig two-way O/U 2.5 into an implied P(over 2.5 goals).
 */
export function deviggedOverProb(overOdds: number, underOdds: number): number | null {
  if (!Number.isFinite(overOdds) || !Number.isFinite(underOdds) || overOdds <= 1.02 || underOdds <= 1.02) {
    return null;
  }
  const io = 1 / overOdds;
  const iu = 1 / underOdds;
  return io / (io + iu);
}

/**
 * For total goals T ~ Poisson(λ), P(T > 2) = P(T >= 3).
 * Invert to find λ that matches market-implied P(over 2.5).
 */
export function inferLambdaTotalFromOver25(overOdds: number, underOdds: number): number | null {
  const pTarget = deviggedOverProb(overOdds, underOdds);
  if (pTarget == null) return null;
  const pOver = (lam: number) => {
    let pLe2 = 0;
    for (let k = 0; k <= 2; k++) {
      pLe2 += poissonPmf(k, lam);
    }
    return clamp(1 - pLe2, 0, 1);
  };
  let lo = 0.35;
  let hi = 5.8;
  if (pOver(lo) > pTarget) return lo;
  if (pOver(hi) < pTarget) return hi;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (pOver(mid) > pTarget) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export type TotalGoalsBand = "LOW" | "MID" | "HIGH";

/** Realized goals bucket for cohort matching. */
export function bandFromRealizedTotalGoals(g: number): TotalGoalsBand {
  if (g <= 2) return "LOW";
  if (g === 3) return "MID";
  return "HIGH";
}

/** Bucket implied expected total from inverted O/U 2.5 line. */
export function bandFromImpliedLambdaTotal(lambda: number): TotalGoalsBand {
  if (lambda < 2.35) return "LOW";
  if (lambda < 3.2) return "MID";
  return "HIGH";
}

import { clamp } from "../utils/math";

export function computeTrustIndex(params: {
  dataQualityScore: number;
  marketAlignmentScore: number;
  similarityScore: number;
  volatilityScore: number;
  mockData: boolean;
  uncertaintyIndex?: number;
}): number {
  const antiVol = 100 - params.volatilityScore;
  const u = params.uncertaintyIndex ?? 50;
  const raw =
    0.3 * params.dataQualityScore +
    0.22 * params.marketAlignmentScore +
    0.2 * params.similarityScore +
    0.22 * antiVol -
    0.06 * u;
  return clamp(raw * (params.mockData ? 0.88 : 1), 12, 98);
}

/** @deprecated Use calibrationEngine.calibrateTriplet + adaptiveShrinkage — kept for tests/import stability. */
export function calibrateToMarket(
  p: { pHome: number; pDraw: number; pAway: number },
  mkt: { home: number; draw: number; away: number },
  shrink = 0.12
): { cHome: number; cDraw: number; cAway: number } {
  const cHome = (1 - shrink) * p.pHome + shrink * mkt.home;
  const cDraw = (1 - shrink) * p.pDraw + shrink * mkt.draw;
  const cAway = (1 - shrink) * p.pAway + shrink * mkt.away;
  const s = cHome + cDraw + cAway;
  return { cHome: cHome / s, cDraw: cDraw / s, cAway: cAway / s };
}

export function totalGoalsBand(lambdaH: number, lambdaA: number): { low: number; high: number } {
  const mu = lambdaH + lambdaA;
  const sd = Math.sqrt(Math.max(0.15, lambdaH + lambdaA));
  return { low: clamp(mu - 1.15 * sd, 0.2, 8), high: clamp(mu + 1.25 * sd, 0.8, 8.5) };
}

export function buildMethodologyBullets(flags: {
  cohortSize: number;
  mockData: boolean;
  similarityApplied: boolean;
  modelVersion: string;
  dixonColesRho: number;
  empiricalBlend?: number;
  ouAnchored?: boolean;
}): string[] {
  const lines = [
    `${flags.modelVersion}: attack/defense decomposition on log-rates with league baseline; Poisson score lattice + Dixon–Coles ρ≈${flags.dixonColesRho.toFixed(3)} for low-score dependence.`,
    "1X2 from the same normalized lattice as exact-score lines (no independent guesswork).",
  ];
  if (flags.ouAnchored) {
    lines.push(
      "Total Poisson intensity softly anchored to de-vigged O/U 2.5 when both sides of the line are available — keeps λ aligned with the goals market."
    );
  }
  if ((flags.empiricalBlend ?? 0) > 0.05) {
    lines.push(
      `Rolling team GF/GA from settled fixtures in the database are blended into Poisson means (weight ≈${((flags.empiricalBlend ?? 0) * 100).toFixed(0)}%), with shrinkage when sample size is small.`
    );
  } else {
    lines.push(
      "Insufficient overlapping finished-match history for both sides — λ driven by form/xG features and de-vigged market priors until the database accumulates games."
    );
  }
  if (flags.similarityApplied) {
    lines.push(
      `Historical cohort (n≈${flags.cohortSize}) matches on de-vigged 1X2 bands + total-goals context + form/strength — not team-name matching.`
    );
  } else {
    lines.push("Similarity cohort bootstrapped from synthetic structural draws until enough settled fixtures exist.");
  }
  if (flags.mockData) {
    lines.push("Synthetic pricing plane — connect live feeds for closing-line-grade inputs.");
  } else {
    lines.push("Book snapshots de-vigged to naive overround; market blend is a calibration layer, not a truth oracle.");
  }
  lines.push(
    "Adaptive shrinkage pulls probabilities toward prices when data quality, similarity, or volatility is weak."
  );
  lines.push("NO BET when uncertainty index, volatility, or thin data breach policy thresholds.");
  return lines;
}

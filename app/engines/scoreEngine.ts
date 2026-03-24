import {
  bttsProbability,
  defaultDixonColesRho,
  overGoalsProbability,
  poissonScoreMatrix,
  poissonScoreMatrixDC,
} from "../utils/math";

export type ScoreMatrixCell = { home: number; away: number; p: number };

export type OutcomeProbs = { pHome: number; pDraw: number; pAway: number };

export type ScoreEngineResult = {
  matrix: ScoreMatrixCell[];
  rho: number;
  outcome: OutcomeProbs;
  topScorelines: ScoreMatrixCell[];
  bttsProb: number;
  pOver25: number;
  pOver35: number;
};

function aggregate1x2(m: ScoreMatrixCell[]): OutcomeProbs {
  let pHome = 0,
    pDraw = 0,
    pAway = 0;
  for (const cell of m) {
    if (cell.home > cell.away) pHome += cell.p;
    else if (cell.home === cell.away) pDraw += cell.p;
    else pAway += cell.p;
  }
  const s = pHome + pDraw + pAway;
  return { pHome: pHome / s, pDraw: pDraw / s, pAway: pAway / s };
}

/**
 * Full score lattice with Dixon–Coles low-score correction; 1X2 from the same normalized mass.
 */
export function buildScoreLattice(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals = 6,
  useDC = true
): ScoreEngineResult {
  const rho = useDC ? defaultDixonColesRho(lambdaHome, lambdaAway) : 0;
  const matrix = useDC
    ? poissonScoreMatrixDC(lambdaHome, lambdaAway, maxGoals, rho)
    : poissonScoreMatrix(lambdaHome, lambdaAway, maxGoals);
  const outcome = aggregate1x2(matrix);
  const topScorelines = matrix.slice(0, 8);
  const bttsProb = bttsProbability(lambdaHome, lambdaAway);
  return {
    matrix,
    rho,
    outcome,
    topScorelines,
    bttsProb,
    pOver25: overGoalsProbability(lambdaHome, lambdaAway, 2.5),
    pOver35: overGoalsProbability(lambdaHome, lambdaAway, 3.5),
  };
}

export function pickExactAndAltScore(lattice: ScoreEngineResult): {
  exactScore: string;
  altScore: string;
  /** Share of joint mass on the modal scoreline (same lattice as 1X2). */
  topMassShare: number;
  /** Top vs runner-up cell mass — low values mean the goal model is diffuse. */
  massRatioTopTwo: number;
} {
  const top = lattice.topScorelines[0]!;
  const second = lattice.topScorelines[1] ?? top;
  const sumP = lattice.matrix.reduce((a, c) => a + c.p, 0) || 1;
  const topMassShare = top.p / sumP;
  const massRatioTopTwo = top.p / Math.max(second.p, 1e-9);
  return {
    exactScore: `${top.home}-${top.away}`,
    altScore: `${second.home}-${second.away}`,
    topMassShare,
    massRatioTopTwo,
  };
}

/** Legacy helper: independent Poisson only (used when DC disabled). */
export function outcomeFromLambdas(lambdaHome: number, lambdaAway: number): OutcomeProbs {
  return buildScoreLattice(lambdaHome, lambdaAway, 6, true).outcome;
}

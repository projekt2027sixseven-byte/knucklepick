import {
  compositeConfidence,
  dataQualityFromInputs,
  volatilityFromProbs,
} from "./confidenceEngine";
import { adaptiveShrinkage, calibrateTriplet } from "./calibrationEngine";
import { expectedGoalsModel } from "./goalEngine";
import { analyzeMarketVsModel } from "./marketEngine";
import { buildScoreLattice, pickExactAndAltScore } from "./scoreEngine";
import { buildScenarios } from "./scenarioEngine";
import { detectTrap } from "./trapDetection";
import { buildCurrentFeatures, findSimilarMatches, syntheticHistoricalPool } from "./similarityEngine";
import type { EngineWeights } from "./weights";
import type { HistoricalMatchForSimilarity } from "../integrations/types";
import type { RollingForLambda } from "./empiricalRatings";
import { MODEL_VERSION } from "../constants/product";
import { clamp, impliedProbabilities } from "../utils/math";
import {
  buildMethodologyBullets,
  computeTrustIndex,
  totalGoalsBand,
} from "./trustEngine";
import { uncertaintyIndex as computeUncertainty } from "./uncertaintyEngine";

export type RiskLevelStr = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

export type PredictionEngineInput = {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  homeFormPts: number;
  awayFormPts: number;
  homeXG: number;
  awayXG: number;
  homeGoalsAgainstAvg: number;
  awayGoalsAgainstAvg: number;
  strengthGap: number;
  hasStats: boolean;
  mockData: boolean;
  weights: EngineWeights;
  historicalPool?: HistoricalMatchForSimilarity[];
  restDaysHome?: number;
  restDaysAway?: number;
  leagueStrengthIndex?: number;
  /** Rolling GF/GA from finished matches (DB). */
  rolling?: RollingForLambda | null;
  /** Weight of empirical λ blend (0–1). */
  empiricalBlend?: number;
};

export type PredictionEngineOutput = {
  outcomePrediction: "HOME" | "DRAW" | "AWAY";
  confidence: number;
  modelConfidence: number;
  dataQualityScore: number;
  marketAlignmentScore: number;
  similarityScore: number;
  volatilityScore: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  expectedTotalGoals: number;
  exactScore: string;
  altScore: string;
  bttsPrediction: "YES" | "NO" | "UNCERTAIN";
  overUnderPrediction: "OVER" | "UNDER" | "UNCERTAIN";
  valueScore: number;
  riskLevel: RiskLevelStr;
  reasoning: string;
  noBet: boolean;
  trapMatch: boolean;
  scenarios: ReturnType<typeof buildScenarios>;
  similarityStats: ReturnType<typeof findSimilarMatches>["stats"];
  similarRefs: { refMatchExt: string; similarity: number; result1x2?: string; score?: string }[];
  factors: { name: string; weight: number; contribution: number; detail?: string }[];
  modelProbs: { pHome: number; pDraw: number; pAway: number };
  marketAlignment: ReturnType<typeof analyzeMarketVsModel>;
  trustIndex: number;
  calibratedProbs: { cHome: number; cDraw: number; cAway: number };
  goalsBand: { low: number; high: number };
  modelVersion: string;
  methodology: string[];
};

function mapRisk(vol: number, valueScore: number, noBet: boolean): RiskLevelStr {
  if (noBet) return "EXTREME";
  const score = vol * 0.62 + (valueScore < -0.05 ? 18 : 0) + (Math.abs(valueScore) > 0.12 ? 8 : 0);
  if (score < 35) return "LOW";
  if (score < 55) return "MEDIUM";
  if (score < 75) return "HIGH";
  return "EXTREME";
}

function normalizeTriplet(p: { pHome: number; pDraw: number; pAway: number }) {
  const s = p.pHome + p.pDraw + p.pAway;
  return { pHome: p.pHome / s, pDraw: p.pDraw / s, pAway: p.pAway / s };
}

export function runPredictionEngine(input: PredictionEngineInput): PredictionEngineOutput {
  const pool = input.historicalPool ?? syntheticHistoricalPool(200);
  const imp = impliedProbabilities(input.homeOdds, input.drawOdds, input.awayOdds);

  const goalOut = expectedGoalsModel({
    homeOdds: input.homeOdds,
    drawOdds: input.drawOdds,
    awayOdds: input.awayOdds,
    homeFormPts: input.homeFormPts,
    awayFormPts: input.awayFormPts,
    homeXG: input.homeXG,
    awayXG: input.awayXG,
    homeGoalsAgainstAvg: input.homeGoalsAgainstAvg,
    awayGoalsAgainstAvg: input.awayGoalsAgainstAvg,
    impliedHome: imp.home,
    impliedAway: imp.away,
    weights: input.weights,
    hasStats: input.hasStats,
    mockData: input.mockData,
    strengthGap: input.strengthGap,
    restDaysHome: input.restDaysHome,
    restDaysAway: input.restDaysAway,
    leagueStrengthIndex: input.leagueStrengthIndex,
    rolling: input.rolling,
    empiricalBlend: input.empiricalBlend,
  });

  const { lambdaHome, lambdaAway } = goalOut;
  const lattice = buildScoreLattice(lambdaHome, lambdaAway, 6, true);
  const rawModel = lattice.outcome;

  const blended = normalizeTriplet({
    pHome: (1 - input.weights.market) * rawModel.pHome + input.weights.market * imp.home,
    pDraw: (1 - input.weights.market) * rawModel.pDraw + input.weights.market * imp.draw,
    pAway: (1 - input.weights.market) * rawModel.pAway + input.weights.market * imp.away,
  });

  const marketFull = analyzeMarketVsModel(input.homeOdds, input.drawOdds, input.awayOdds, blended);

  const curFeat = buildCurrentFeatures({
    homeOdds: input.homeOdds,
    drawOdds: input.drawOdds,
    awayOdds: input.awayOdds,
    strengthGap: input.strengthGap,
    homeForm: input.homeFormPts,
    awayForm: input.awayFormPts,
  });
  const sim = findSimilarMatches(curFeat, pool, 14);

  const k = input.weights.similarity * 0.014;
  const third = 1 / 3;
  const simAdj = normalizeTriplet({
    pHome: clamp(blended.pHome + (sim.stats.winRateHome / 100 - third) * k, 0.03, 0.92),
    pDraw: clamp(blended.pDraw + (sim.stats.winRateDraw / 100 - third) * k, 0.03, 0.92),
    pAway: clamp(blended.pAway + (sim.stats.winRateAway / 100 - third) * k, 0.03, 0.92),
  });

  let outcome: "HOME" | "DRAW" | "AWAY" = "DRAW";
  if (simAdj.pHome >= simAdj.pDraw && simAdj.pHome >= simAdj.pAway) outcome = "HOME";
  else if (simAdj.pAway >= simAdj.pDraw && simAdj.pAway >= simAdj.pHome) outcome = "AWAY";

  const { exactScore, altScore } = pickExactAndAltScore(lattice);
  const totalXG = lambdaHome + lambdaAway;

  const bttsPrediction: PredictionEngineOutput["bttsPrediction"] =
    lattice.bttsProb > 0.53 ? "YES" : lattice.bttsProb < 0.41 ? "NO" : "UNCERTAIN";
  const overUnderPrediction: PredictionEngineOutput["overUnderPrediction"] =
    lattice.pOver25 > 0.56 ? "OVER" : lattice.pOver25 < 0.44 ? "UNDER" : "UNCERTAIN";

  const dataQualityScore = dataQualityFromInputs(true, input.hasStats, input.mockData);
  const volatilityScore = volatilityFromProbs(simAdj.pHome, simAdj.pDraw, simAdj.pAway);
  const modelSpread = Math.max(simAdj.pHome, simAdj.pDraw, simAdj.pAway) * 100;

  const uncertainty = computeUncertainty({
    volatilityScore,
    dataQualityScore,
    similarityScore: sim.similarityScore,
    disagreementL1: marketFull.disagreementL1,
  });

  const { confidence, modelConfidence } = compositeConfidence({
    dataQualityScore: dataQualityScore / 100,
    marketAlignmentScore: marketFull.alignmentScore,
    similarityScore: sim.similarityScore,
    volatilityScore,
    modelSpread,
    uncertaintyIndex: uncertainty.uncertaintyIndex,
  });

  const mktMax = Math.max(marketFull.marketProbHome, marketFull.marketProbDraw, marketFull.marketProbAway);
  const trap = detectTrap(mktMax, modelConfidence, marketFull.disagreementL1);

  const conflicting =
    (outcome === "HOME" && marketFull.marketProbAway > 0.38) ||
    (outcome === "AWAY" && marketFull.marketProbHome > 0.38);

  const modelWeight = adaptiveShrinkage({
    dataQuality01: dataQualityScore / 100,
    volatility01: volatilityScore / 100,
    mockData: input.mockData,
    similarity01: sim.similarityScore / 100,
  });
  const calibratedProbs = calibrateTriplet(
    simAdj,
    {
      home: marketFull.marketProbHome,
      draw: marketFull.marketProbDraw,
      away: marketFull.marketProbAway,
    },
    1 - modelWeight
  );

  const thinSimilarity = sim.stats.sampleSize < 6 || sim.similarityScore < 34;
  const noBet =
    confidence < 0.36 ||
    uncertainty.uncertaintyIndex > 80 ||
    volatilityScore > 76 ||
    dataQualityScore < 44 ||
    (conflicting && sim.similarityScore < 40) ||
    thinSimilarity ||
    (!marketFull.meaningfulEdge && Math.abs(marketFull.valueScore) < 0.025 && sim.similarityScore < 48);

  const riskLevel = mapRisk(volatilityScore, marketFull.valueScore, noBet);

  const fav: "HOME" | "DRAW" | "AWAY" =
    marketFull.marketProbHome >= marketFull.marketProbDraw &&
    marketFull.marketProbHome >= marketFull.marketProbAway
      ? "HOME"
      : marketFull.marketProbAway >= marketFull.marketProbDraw
        ? "AWAY"
        : "DRAW";

  const scenarios = buildScenarios(lattice, lambdaHome, lambdaAway, fav);

  const edgeNote = marketFull.meaningfulEdge
    ? `Largest raw edge ${(marketFull.valueScore * 100).toFixed(1)}% on ${marketFull.valueSide}.`
    : `Edges vs market are within noise (${(marketFull.valueScore * 100).toFixed(1)}% max); down-weighted for value display.`;

  const empNote =
    (input.empiricalBlend ?? 0) > 0.05 && input.rolling
      ? `Empirical blend ${((input.empiricalBlend ?? 0) * 100).toFixed(0)}% from rolling GF/GA (n≈${Math.min(input.rolling.nHome, input.rolling.nAway)}).`
      : "Empirical blend off (thin history) — λ from features + market priors.";

  const reasoningParts = [
    `Structural lean ${outcome} (calibrated triplet; retained ${(modelWeight * 100).toFixed(0)}% model mass vs implied prices).`,
    empNote,
    `Expected goals: ${lambdaHome.toFixed(2)} vs ${lambdaAway.toFixed(2)} (total ${totalXG.toFixed(2)}); Dixon–Coles ρ=${lattice.rho.toFixed(3)} on the score lattice.`,
    `Modal scoreline ${exactScore} (alt ${altScore}) from top joint masses, not independent guesses.`,
    `BTTS P≈${(lattice.bttsProb * 100).toFixed(0)}%; P(over 2.5)≈${(lattice.pOver25 * 100).toFixed(0)}%.`,
    `Market alignment ${marketFull.alignmentScore.toFixed(0)}/100; disagreement L1=${marketFull.disagreementL1.toFixed(2)}. ${edgeNote}`,
    `Similarity cohort n=${sim.stats.sampleSize} (structural): H/D/A ${sim.stats.winRateHome.toFixed(0)}% / ${sim.stats.winRateDraw.toFixed(0)}% / ${sim.stats.winRateAway.toFixed(0)}%; BTTS≈${sim.stats.bttsPct.toFixed(0)}%; O2.5≈${sim.stats.over25Pct.toFixed(0)}%.`,
    trap.isTrap ? trap.reason! : "No elevated trap signature under current thresholds.",
    noBet
      ? "NO BET: uncertainty, thin cohort, or policy gates triggered."
      : "Within policy gates for actionable read (still subject to bankroll discipline).",
  ];

  const factors: PredictionEngineOutput["factors"] = [
    {
      name: "Score lattice (Poisson + DC)",
      weight: 0.32,
      contribution: modelSpread / 100,
      detail: `ρ=${lattice.rho.toFixed(3)}; top mass ${exactScore}`,
    },
    {
      name: "Rolling GF/GA (DB)",
      weight: input.empiricalBlend ?? 0,
      contribution: clamp(input.empiricalBlend ?? 0, 0, 1),
      detail:
        (input.empiricalBlend ?? 0) > 0.04 && input.rolling
          ? `Blend ${((input.empiricalBlend ?? 0) * 100).toFixed(0)}%; league μ≈${input.rolling.leagueAvgGoalsPerGame.toFixed(2)} G/match`
          : "No blend — insufficient finished-match history",
    },
    {
      name: "Attack/defense + home adv",
      weight: input.weights.form + input.weights.xg + input.weights.defense,
      contribution: clamp((goalOut.homeStrength.attack + goalOut.awayStrength.attack) / 4, 0, 1),
      detail: `Baseline μ≈${goalOut.baseline.toFixed(2)} goals`,
    },
    {
      name: "Market calibration",
      weight: 1 - modelWeight,
      contribution: marketFull.alignmentScore / 100,
      detail: `Implied pull ${((1 - modelWeight) * 100).toFixed(0)}% when epistemic uncertainty is elevated`,
    },
    {
      name: "Structural similarity",
      weight: input.weights.similarity,
      contribution: sim.similarityScore / 100,
      detail: `Cohort BTTS/O2.5/O3.5 frequencies for context`,
    },
  ];

  const trustIndex = computeTrustIndex({
    dataQualityScore,
    marketAlignmentScore: marketFull.alignmentScore,
    similarityScore: sim.similarityScore,
    volatilityScore,
    mockData: input.mockData,
    uncertaintyIndex: uncertainty.uncertaintyIndex,
  });

  const goalsBand = totalGoalsBand(lambdaHome, lambdaAway);
  const methodology = buildMethodologyBullets({
    cohortSize: sim.stats.sampleSize,
    mockData: input.mockData,
    similarityApplied: (input.historicalPool?.length ?? 0) >= 8,
    modelVersion: MODEL_VERSION,
    dixonColesRho: lattice.rho,
    empiricalBlend: input.empiricalBlend,
  });

  return {
    outcomePrediction: outcome,
    confidence,
    modelConfidence,
    dataQualityScore,
    marketAlignmentScore: marketFull.alignmentScore,
    similarityScore: sim.similarityScore,
    volatilityScore,
    expectedHomeGoals: lambdaHome,
    expectedAwayGoals: lambdaAway,
    expectedTotalGoals: totalXG,
    exactScore,
    altScore,
    bttsPrediction,
    overUnderPrediction,
    valueScore: marketFull.meaningfulEdge ? marketFull.valueScore : marketFull.edgeScore,
    riskLevel,
    reasoning: reasoningParts.join(" "),
    noBet,
    trapMatch: trap.isTrap,
    scenarios,
    similarityStats: sim.stats,
    similarRefs: sim.similarMatches.map((m) => ({
      refMatchExt: m.ref.externalId,
      similarity: m.score,
      result1x2: m.ref.result1x2,
      score: m.ref.scoreLabel,
    })),
    factors,
    modelProbs: { pHome: simAdj.pHome, pDraw: simAdj.pDraw, pAway: simAdj.pAway },
    marketAlignment: marketFull,
    trustIndex,
    calibratedProbs: {
      cHome: calibratedProbs.cHome,
      cDraw: calibratedProbs.cDraw,
      cAway: calibratedProbs.cAway,
    },
    goalsBand,
    modelVersion: MODEL_VERSION,
    methodology,
  };
}

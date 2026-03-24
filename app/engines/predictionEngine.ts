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
  /** Live O/U 2.5 prices — anchor total λ when present (backend only). */
  over25?: number;
  under25?: number;
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

function tripletProbMargin(p: { pHome: number; pDraw: number; pAway: number }): number {
  const [a, b] = [p.pHome, p.pDraw, p.pAway].sort((x, y) => y - x);
  return a - b;
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
    over25: input.over25,
    under25: input.under25,
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

  const { exactScore, altScore, topMassShare, massRatioTopTwo } = pickExactAndAltScore(lattice);
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

  const probMargin = tripletProbMargin(simAdj);

  let { confidence, modelConfidence } = compositeConfidence({
    dataQualityScore: dataQualityScore / 100,
    marketAlignmentScore: marketFull.alignmentScore,
    similarityScore: sim.similarityScore,
    volatilityScore,
    modelSpread,
    uncertaintyIndex: uncertainty.uncertaintyIndex,
    probMargin,
    disagreementL1: marketFull.disagreementL1,
  });

  const mktMax = Math.max(marketFull.marketProbHome, marketFull.marketProbDraw, marketFull.marketProbAway);
  const trap = detectTrap(mktMax, modelConfidence, marketFull.disagreementL1);
  if (trap.isTrap) {
    confidence = clamp(confidence * 0.8, 0, 0.78);
    modelConfidence = clamp(modelConfidence * 0.85, 0, 0.8);
  }

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

  const thinSimilarity = sim.stats.sampleSize < 6 || sim.similarityScore < 36;
  const weakSeparation = probMargin < 0.052 && modelSpread < 51;
  const diffuseScoreline =
    topMassShare < 0.058 && massRatioTopTwo < 1.72 && probMargin < 0.062;
  const marketModelTension =
    marketFull.disagreementL1 > 0.54 && probMargin < 0.075 && marketFull.edgeQuality !== "STRONG";
  const conflictBlock =
    conflicting &&
    (probMargin < 0.064 || sim.similarityScore < 43 || marketFull.edgeQuality === "NONE");
  const noBet =
    confidence < 0.44 ||
    uncertainty.uncertaintyIndex > 72 ||
    volatilityScore > 70 ||
    dataQualityScore < 48 ||
    (conflicting && sim.similarityScore < 42) ||
    thinSimilarity ||
    weakSeparation ||
    diffuseScoreline ||
    marketModelTension ||
    conflictBlock ||
    (trap.isTrap && probMargin < 0.068) ||
    (!marketFull.meaningfulEdge &&
      Math.abs(marketFull.valueScore) < 0.028 &&
      sim.similarityScore < 50);

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
    ? `Largest raw edge ${(marketFull.valueScore * 100).toFixed(1)}% on ${marketFull.valueSide} (${marketFull.edgeQuality} tier vs noise floor).`
    : `No robust edge vs de-vigged 1X2 (${(marketFull.valueScore * 100).toFixed(1)}% max; ${marketFull.edgeQuality}).`;

  const ouNote =
    input.over25 && input.under25
      ? `O/U 2.5 prices folded into total λ (book over ${input.over25.toFixed(2)} / under ${input.under25.toFixed(2)}).`
      : "O/U 2.5 not available — total intensity from 1X2 shape + team features only.";

  const empNote =
    (input.empiricalBlend ?? 0) > 0.05 && input.rolling
      ? `Empirical blend ${((input.empiricalBlend ?? 0) * 100).toFixed(0)}% from rolling GF/GA (n≈${Math.min(input.rolling.nHome, input.rolling.nAway)}).`
      : "Empirical blend off (thin history) — λ from form/xG/defense + strength gap + market priors.";

  const reasoningParts = [
    `Pick ${outcome}: top calibrated mass ${(Math.max(simAdj.pHome, simAdj.pDraw, simAdj.pAway) * 100).toFixed(1)}% with ${(probMargin * 100).toFixed(1)}pp separation vs runner-up; ${(modelWeight * 100).toFixed(0)}% structural model mass retained before market shrink.`,
    `Strength gap from standings/form tilts attack/defense; ${ouNote}`,
    empNote,
    `λ_home=${lambdaHome.toFixed(2)}, λ_away=${lambdaAway.toFixed(2)} (Σ=${totalXG.toFixed(2)}); Dixon–Coles ρ=${lattice.rho.toFixed(3)}.`,
    `Exact line ${exactScore} (alt ${altScore}) is the lattice mode (top cell mass ${(topMassShare * 100).toFixed(1)}%; headroom ${massRatioTopTwo.toFixed(2)}× vs next).`,
    `BTTS P≈${(lattice.bttsProb * 100).toFixed(0)}%; P(over 2.5)≈${(lattice.pOver25 * 100).toFixed(0)}%.`,
    `Market vs model: alignment ${marketFull.alignmentScore.toFixed(0)}/100; L1=${marketFull.disagreementL1.toFixed(2)}. ${edgeNote}`,
    `Cohort n=${sim.stats.sampleSize}, label ${sim.stats.similarityStrengthLabel}: H/D/A ${sim.stats.winRateHome.toFixed(0)}% / ${sim.stats.winRateDraw.toFixed(0)}% / ${sim.stats.winRateAway.toFixed(0)}%; upset rate ${sim.stats.upsetFrequencyPct.toFixed(0)}%.`,
    trap.isTrap ? trap.reason! : "No trap signature vs current thresholds.",
    noBet
      ? "NO BET: weak separation, diffuse score mass, model–market tension, thin cohort, or policy gates."
      : "Signals clear enough for a ranked read — edge tier and cohort quality still cap stake sizing.",
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
      detail: `μ≈${goalOut.baseline.toFixed(2)}; strength-gap tilt applied`,
    },
    {
      name: "O/U 2.5 anchor",
      weight: input.over25 && input.under25 ? 0.14 : 0,
      contribution: input.over25 && input.under25 ? 0.75 : 0.2,
      detail: ouNote,
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

  let trustIndex = computeTrustIndex({
    dataQualityScore,
    marketAlignmentScore: marketFull.alignmentScore,
    similarityScore: sim.similarityScore,
    volatilityScore,
    mockData: input.mockData,
    uncertaintyIndex: uncertainty.uncertaintyIndex,
  });
  if (marketFull.edgeQuality === "NONE" || marketFull.edgeQuality === "WEAK") {
    trustIndex = clamp(trustIndex - (marketFull.edgeQuality === "NONE" ? 10 : 5), 8, 98);
  }
  if (probMargin < 0.06) trustIndex = clamp(trustIndex - 6, 8, 98);

  const goalsBand = totalGoalsBand(lambdaHome, lambdaAway);
  const methodology = buildMethodologyBullets({
    cohortSize: sim.stats.sampleSize,
    mockData: input.mockData,
    similarityApplied: (input.historicalPool?.length ?? 0) >= 8,
    modelVersion: MODEL_VERSION,
    dixonColesRho: lattice.rho,
    empiricalBlend: input.empiricalBlend,
    ouAnchored: Boolean(input.over25 && input.under25),
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

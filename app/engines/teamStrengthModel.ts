import { clamp } from "../utils/math";
import type { MatchFeatureVector } from "./matchFeatures";
import { leagueBaselineGoals, restFatigueFactor } from "./matchFeatures";

/**
 * Lightweight attack/defense decomposition (not full league-wide MLE — structured so it can be
 * replaced later with estimated team ratings from historical data).
 */
export type TeamStrength = {
  attack: number;
  defense: number;
};

function normalizeForm(f: number): number {
  return clamp((f - 0.8) / 2.2, -0.5, 1.2);
}

function normalizeXG(x: number): number {
  return clamp((x - 0.85) / 1.4, -0.4, 1.4);
}

function normalizeGA(ga: number): number {
  return clamp((ga - 0.85) / 0.9, -0.3, 1.2);
}

export function homeSideStrength(f: MatchFeatureVector, w: MatchFeatureVector["weights"]): TeamStrength {
  const atk =
    w.form * normalizeForm(f.formHome) +
    w.xg * normalizeXG(f.xgHome) +
    w.odds * (f.implied.home * 2.2 - 0.9);
  const def = w.defense * normalizeGA(f.goalsAgainstHome);
  return { attack: atk, defense: def };
}

export function awaySideStrength(f: MatchFeatureVector, w: MatchFeatureVector["weights"]): TeamStrength {
  const atk =
    w.form * normalizeForm(f.formAway) +
    w.xg * normalizeXG(f.xgAway) +
    w.odds * (f.implied.away * 2.2 - 0.9);
  const def = w.defense * normalizeGA(f.goalsAgainstAway);
  return { attack: atk, defense: def };
}

/**
 * Home advantage expressed as additive lift on log-rate (typical ~0.20–0.32 for top leagues).
 * Scaled down when data is mock or stats missing.
 */
export function homeAdvantageLambda(f: MatchFeatureVector): number {
  let ha = 0.28 + 0.04 * clamp(f.strengthGap, -1.5, 1.5);
  if (!f.hasStats) ha *= 0.85;
  if (f.mockData) ha *= 0.92;
  return clamp(ha, 0.12, 0.42);
}

/**
 * Convert strengths to Poisson means: λ_h = μ * exp(a_h - d_a + HA), λ_a = μ * exp(a_a - d_h).
 */
export type GoalExpectationOutput = {
  lambdaHome: number;
  lambdaAway: number;
  baseline: number;
  homeStrength: TeamStrength;
  awayStrength: TeamStrength;
  homeAdvantageLog: number;
};

export function lambdasFromStrengths(
  home: TeamStrength,
  away: TeamStrength,
  homeAdvLog: number,
  baseline: number,
  restDaysHome: number,
  restDaysAway: number
): { lambdaHome: number; lambdaAway: number } {
  const fh = restFatigueFactor(restDaysHome);
  const fa = restFatigueFactor(restDaysAway);
  const lh =
    baseline *
    Math.exp(clamp(home.attack - away.defense + homeAdvLog, -1.1, 1.35)) *
    fh;
  const la = baseline * Math.exp(clamp(away.attack - home.defense, -1.1, 1.35)) * fa;
  return {
    lambdaHome: clamp(lh, 0.35, 4.2),
    lambdaAway: clamp(la, 0.35, 4.2),
  };
}

export function expectedGoalsFromFeatures(f: MatchFeatureVector): GoalExpectationOutput {
  const w = f.weights;
  const baseline = leagueBaselineGoals(f);
  const homeS = homeSideStrength(f, w);
  const awayS = awaySideStrength(f, w);
  const ha = homeAdvantageLambda(f);
  const { lambdaHome, lambdaAway } = lambdasFromStrengths(
    homeS,
    awayS,
    ha,
    baseline,
    f.restDaysHome,
    f.restDaysAway
  );

  return {
    lambdaHome,
    lambdaAway,
    baseline,
    homeStrength: homeS,
    awayStrength: awayS,
    homeAdvantageLog: ha,
  };
}

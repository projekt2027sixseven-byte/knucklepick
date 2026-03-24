import { impliedProbabilities } from "../utils/math";
import type { EngineWeights } from "./weights";

/**
 * Normalized feature layer for a single fixture. Designed so new signals (lineups, Elo, etc.)
 * can be threaded through without rewriting the goal or calibration modules.
 */
export type MatchFeatureVector = {
  /** Rolling form proxies (points per game scale, typically ~0.5–2.5). */
  formHome: number;
  formAway: number;
  /** Expected goals for / against style rates (per match). */
  xgHome: number;
  xgAway: number;
  /** Average goals conceded (defensive leakiness). */
  goalsAgainstHome: number;
  goalsAgainstAway: number;
  /** Market-implied 1X2 after removing overround normalization. */
  implied: { home: number; draw: number; away: number };
  /** Signed strength gap (home minus away) from upstream stats. */
  strengthGap: number;
  /** Optional: days since last match (0 = unknown). Used as fatigue proxy when >0. */
  restDaysHome: number;
  restDaysAway: number;
  /** Optional league difficulty multiplier (1 = average top tier). */
  leagueStrengthIndex: number;
  /** Data availability flags */
  hasStats: boolean;
  mockData: boolean;
  weights: EngineWeights;
};

const DEFAULT_LEAGUE_BASELINE = 2.65;

export function buildMatchFeatureVector(params: {
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
  restDaysHome?: number;
  restDaysAway?: number;
  leagueStrengthIndex?: number;
}): MatchFeatureVector {
  return {
    formHome: params.homeFormPts,
    formAway: params.awayFormPts,
    xgHome: params.homeXG,
    xgAway: params.awayXG,
    goalsAgainstHome: params.homeGoalsAgainstAvg,
    goalsAgainstAway: params.awayGoalsAgainstAvg,
    implied: impliedProbabilities(params.homeOdds, params.drawOdds, params.awayOdds),
    strengthGap: params.strengthGap,
    restDaysHome: params.restDaysHome ?? 0,
    restDaysAway: params.restDaysAway ?? 0,
    leagueStrengthIndex: params.leagueStrengthIndex ?? 1,
    hasStats: params.hasStats,
    mockData: params.mockData,
    weights: params.weights,
  };
}

export function leagueBaselineGoals(f: MatchFeatureVector): number {
  const base = DEFAULT_LEAGUE_BASELINE * f.leagueStrengthIndex;
  const env = impliedScoringIntensity(f.implied);
  return base * (0.94 + 0.12 * env);
}

/** Implied “scoring environment” from prices: higher when long-shot prices suggest open game. */
export function impliedScoringIntensity(implied: { home: number; draw: number; away: number }): number {
  const fav = Math.max(implied.home, implied.draw, implied.away);
  const underdog = Math.min(implied.home, implied.draw, implied.away);
  return clamp01((1 - fav) * 0.4 + (1 - underdog) * 0.15);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Fatigue dampens attack multipliers slightly when rest is short (heuristic). */
export function restFatigueFactor(restDays: number): number {
  if (restDays <= 0) return 1;
  if (restDays < 4) return 0.96;
  if (restDays < 6) return 0.99;
  return 1;
}

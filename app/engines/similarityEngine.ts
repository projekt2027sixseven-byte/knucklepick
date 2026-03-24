import { clamp, impliedProbabilities } from "../utils/math";
import type { HistoricalMatchForSimilarity } from "../integrations/types";
import { bandMismatch, classifyOddsBand, totalBandMismatch, type OddsBand } from "./oddsContext";
import {
  bandFromImpliedLambdaTotal,
  bandFromRealizedTotalGoals,
  inferLambdaTotalFromOver25,
  type TotalGoalsBand,
} from "../utils/ouInference";

/**
 * Market-structural features for cohort matching (team-agnostic).
 * Focus: implied shape, strength gap, form, implied scoring environment.
 */
export type CurrentMatchFeatures = {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  impliedHome: number;
  impliedDraw: number;
  impliedAway: number;
  strengthGap: number;
  homeForm: number;
  awayForm: number;
  /** Proxy for expected total goals from prices (not a line — ordinal). */
  impliedScoringEnv: number;
  oddsBand: OddsBand;
  /** Pre-match total environment: from inverted O/U 2.5 when odds exist, else derived from implied shape. */
  totalBand: TotalGoalsBand;
};

export type SimilarityResult = {
  similarMatches: { ref: HistoricalMatchForSimilarity; score: number }[];
  stats: {
    sampleSize: number;
    winRateHome: number;
    winRateDraw: number;
    winRateAway: number;
    avgTotalGoals: number;
    commonScores: { score: string; count: number }[];
    bttsPct: number;
    over25Pct: number;
    over35Pct: number;
    /** Share of cohort where result disagreed with pre-match market favorite (structural upsets). */
    upsetFrequencyPct: number;
    /** Human-readable cohort quality for UI. */
    similarityStrengthLabel: "STRONG" | "MODERATE" | "WEAK";
  };
  similarityScore: number;
};

function rangeDistance(a: number, b: number, scale: number): number {
  return Math.abs(a - b) / scale;
}

function impliedScoringEnv(implied: { home: number; draw: number; away: number }): number {
  const fav = Math.max(implied.home, implied.draw, implied.away);
  return clamp(1 - fav + 0.25 * (1 - implied.draw), 0, 1);
}

function featureDistance(cur: CurrentMatchFeatures, hist: HistoricalMatchForSimilarity): number {
  const dOdds =
    rangeDistance(cur.impliedHome, hist.impliedHome, 0.32) +
    rangeDistance(cur.impliedDraw, hist.impliedDraw, 0.28) +
    rangeDistance(cur.impliedAway, hist.impliedAway, 0.32);
  const dGap = rangeDistance(cur.strengthGap, hist.strengthGap, 1.6);
  const dForm =
    rangeDistance(cur.homeForm, hist.homeForm, 2) + rangeDistance(cur.awayForm, hist.awayForm, 2);
  const histEnv = impliedScoringEnv({
    home: hist.impliedHome,
    draw: hist.impliedDraw,
    away: hist.impliedAway,
  });
  const dEnv = rangeDistance(cur.impliedScoringEnv, histEnv, 0.45);
  const dBands = 0.55 * bandMismatch(cur.oddsBand, hist.oddsBand) + 0.45 * totalBandMismatch(cur.totalBand, hist.totalBand);
  return dOdds * 0.36 + dGap * 0.18 + dForm * 0.17 + dEnv * 0.13 + dBands * 0.16;
}

export function buildCurrentFeatures(params: {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  strengthGap: number;
  homeForm: number;
  awayForm: number;
  over25?: number;
  under25?: number;
}): CurrentMatchFeatures {
  const imp = impliedProbabilities(params.homeOdds, params.drawOdds, params.awayOdds);
  const env = impliedScoringEnv(imp);
  const λOu =
    params.over25 && params.under25
      ? inferLambdaTotalFromOver25(params.over25, params.under25)
      : null;
  const totalBand: TotalGoalsBand =
    λOu != null ? bandFromImpliedLambdaTotal(λOu) : bandFromImpliedScoringEnv(env);
  return {
    homeOdds: params.homeOdds,
    drawOdds: params.drawOdds,
    awayOdds: params.awayOdds,
    impliedHome: imp.home,
    impliedDraw: imp.draw,
    impliedAway: imp.away,
    strengthGap: params.strengthGap,
    homeForm: params.homeForm,
    awayForm: params.awayForm,
    impliedScoringEnv: env,
    oddsBand: classifyOddsBand(imp),
    totalBand,
  };
}

function bandFromImpliedScoringEnv(env: number): TotalGoalsBand {
  if (env < 0.36) return "LOW";
  if (env < 0.52) return "MID";
  return "HIGH";
}

export function findSimilarMatches(
  currentMatch: CurrentMatchFeatures,
  historicalPool: HistoricalMatchForSimilarity[],
  topK = 14
): SimilarityResult {
  const scored = historicalPool.map((h) => ({
    ref: h,
    dist: featureDistance(currentMatch, h),
  }));
  scored.sort((a, b) => a.dist - b.dist);
  const similarMatches = scored.slice(0, topK).map((s) => ({
    ref: s.ref,
    score: clamp(100 * (1 - s.dist / 1.35), 0, 100),
  }));
  const avgScore =
    similarMatches.length > 0
      ? similarMatches.reduce((a, b) => a + b.score, 0) / similarMatches.length
      : 0;

  const refs = similarMatches.map((m) => m.ref);
  const n = refs.length || 1;
  const winH = refs.filter((r) => r.result1x2 === "HOME").length / n;
  const winD = refs.filter((r) => r.result1x2 === "DRAW").length / n;
  const winA = refs.filter((r) => r.result1x2 === "AWAY").length / n;
  const avgGoals = refs.reduce((a, r) => a + r.totalGoals, 0) / n;
  const scoreCounts = new Map<string, number>();
  for (const r of refs) scoreCounts.set(r.scoreLabel, (scoreCounts.get(r.scoreLabel) ?? 0) + 1);
  const commonScores = [...scoreCounts.entries()]
    .map(([score, count]) => ({ score, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const bttsPct = (refs.filter((r) => r.btts).length / n) * 100;
  const over25Pct = (refs.filter((r) => r.over25).length / n) * 100;
  const over35Pct = (refs.filter((r) => r.totalGoals > 3).length / n) * 100;

  function marketFavorite(r: HistoricalMatchForSimilarity): "HOME" | "DRAW" | "AWAY" {
    if (r.impliedHome >= r.impliedDraw && r.impliedHome >= r.impliedAway) return "HOME";
    if (r.impliedDraw >= r.impliedAway) return "DRAW";
    return "AWAY";
  }
  let upsets = 0;
  for (const r of refs) {
    const fav = marketFavorite(r);
    if (r.result1x2 !== fav) upsets += 1;
  }
  const upsetFrequencyPct = (upsets / n) * 100;

  let similarityStrengthLabel: "STRONG" | "MODERATE" | "WEAK" = "WEAK";
  if (refs.length >= 10 && avgScore >= 58) similarityStrengthLabel = "STRONG";
  else if (refs.length >= 6 && avgScore >= 42) similarityStrengthLabel = "MODERATE";

  return {
    similarMatches,
    stats: {
      sampleSize: refs.length,
      winRateHome: winH * 100,
      winRateDraw: winD * 100,
      winRateAway: winA * 100,
      avgTotalGoals: avgGoals,
      commonScores,
      bttsPct,
      over25Pct,
      over35Pct,
      upsetFrequencyPct,
      similarityStrengthLabel,
    },
    similarityScore: clamp(avgScore, 0, 100),
  };
}

export function syntheticHistoricalPool(size = 220): HistoricalMatchForSimilarity[] {
  const out: HistoricalMatchForSimilarity[] = [];
  for (let i = 0; i < size; i++) {
    const homeOdds = 1.5 + Math.random() * 3.5;
    const awayOdds = 1.5 + Math.random() * 3.5;
    const drawOdds = 2.8 + Math.random() * 2.2;
    const imp = impliedProbabilities(homeOdds, drawOdds, awayOdds);
    const strengthGap = (Math.random() - 0.5) * 2.4;
    const homeForm = Math.random() * 3;
    const awayForm = Math.random() * 3;
    const hg = Math.floor(Math.random() * 4);
    const ag = Math.floor(Math.random() * 4);
    let result: "HOME" | "DRAW" | "AWAY" = "DRAW";
    if (hg > ag) result = "HOME";
    if (ag > hg) result = "AWAY";
    const tg = hg + ag;
    out.push({
      externalId: `hist_${i}`,
      homeOdds,
      drawOdds,
      awayOdds,
      impliedHome: imp.home,
      impliedDraw: imp.draw,
      impliedAway: imp.away,
      strengthGap,
      homeForm,
      awayForm,
      oddsBand: classifyOddsBand(imp),
      totalBand: bandFromRealizedTotalGoals(tg),
      result1x2: result,
      totalGoals: tg,
      homeGoals: hg,
      awayGoals: ag,
      btts: hg > 0 && ag > 0,
      over25: hg + ag > 2.5,
      scoreLabel: `${hg}-${ag}`,
    });
  }
  return out;
}

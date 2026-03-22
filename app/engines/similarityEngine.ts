import { clamp, impliedProbabilities } from "../utils/math";
import type { HistoricalMatchForSimilarity } from "../integrations/types";

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
  return dOdds * 0.42 + dGap * 0.22 + dForm * 0.2 + dEnv * 0.16;
}

export function buildCurrentFeatures(params: {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  strengthGap: number;
  homeForm: number;
  awayForm: number;
}): CurrentMatchFeatures {
  const imp = impliedProbabilities(params.homeOdds, params.drawOdds, params.awayOdds);
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
    impliedScoringEnv: impliedScoringEnv(imp),
  };
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
      result1x2: result,
      totalGoals: hg + ag,
      homeGoals: hg,
      awayGoals: ag,
      btts: hg > 0 && ag > 0,
      over25: hg + ag > 2.5,
      scoreLabel: `${hg}-${ag}`,
    });
  }
  return out;
}

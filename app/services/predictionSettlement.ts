import type { PrismaClient } from "../db/prisma-client";
import { clamp } from "../utils/math";

export type Actual1x2 = "HOME" | "DRAW" | "AWAY";

/** Naive 1X2 baseline (uniform) — used only to contextualize realized hit rate, not as a claim of market truth. */
export const NAIVE_BASELINE_1X2 = 1 / 3;

export const TRACK_RECORD_MIN_N = 8;
/** Minimum settled non-mock rows before headline “proof” stats and calibration context. */
export const MIN_HISTORY_FOR_PROOF = 10;
const TRACK_RECORD_WINDOW = 50;

export type TrackRecordAdjustment = {
  sampleSize: number;
  hitRate: number | null;
  naiveBaseline: number;
  confidenceDelta: number;
  trustDelta: number;
};

/**
 * Pure mapping from realized hit rate vs naive 1/3 baseline → bounded nudges for headline confidence and trust.
 * Returns zero deltas when sample is too small (avoids noise-driven swings).
 */
export function computeTrackRecordShifts(hitRate: number, n: number): Pick<TrackRecordAdjustment, "confidenceDelta" | "trustDelta" | "hitRate"> {
  if (n < TRACK_RECORD_MIN_N) {
    return { confidenceDelta: 0, trustDelta: 0, hitRate: n > 0 ? hitRate : null };
  }
  const gap = hitRate - NAIVE_BASELINE_1X2;
  const confidenceDelta = clamp(gap * 0.55, -0.08, 0.08);
  const trustDelta = clamp(gap * 72, -14, 14);
  return { confidenceDelta, trustDelta, hitRate };
}

/**
 * Last N actionable (non–NO BET) settled picks vs naive 1X3 baseline — feeds confidence/trust nudges in the pipeline.
 */
export async function getTrackRecordAdjustment(prisma: PrismaClient): Promise<TrackRecordAdjustment> {
  const rows = await prisma.predictionSettlement.findMany({
    where: { prediction: { mockContext: false, noBet: false } },
    orderBy: { settledAt: "desc" },
    take: TRACK_RECORD_WINDOW,
    select: { outcomeHit: true },
  });
  const n = rows.length;
  if (n === 0) {
    return {
      sampleSize: 0,
      hitRate: null,
      naiveBaseline: NAIVE_BASELINE_1X2,
      confidenceDelta: 0,
      trustDelta: 0,
    };
  }
  const hits = rows.filter((r) => r.outcomeHit).length;
  const hr = hits / n;
  const { confidenceDelta, trustDelta, hitRate } = computeTrackRecordShifts(hr, n);
  return {
    sampleSize: n,
    hitRate,
    naiveBaseline: NAIVE_BASELINE_1X2,
    confidenceDelta,
    trustDelta,
  };
}

export function actual1x2FromScore(homeScore: number, awayScore: number): Actual1x2 {
  if (homeScore > awayScore) return "HOME";
  if (awayScore > homeScore) return "AWAY";
  return "DRAW";
}

function brierTriplet(
  ph: number,
  pd: number,
  pa: number,
  actual: Actual1x2
): number {
  const oh = actual === "HOME" ? 1 : 0;
  const od = actual === "DRAW" ? 1 : 0;
  const oa = actual === "AWAY" ? 1 : 0;
  return (ph - oh) ** 2 + (pd - od) ** 2 + (pa - oa) ** 2;
}

function flatProfitUnits(
  predicted: Actual1x2,
  actual: Actual1x2,
  snapH: number,
  snapD: number,
  snapA: number
): number {
  if (predicted !== actual) return -1;
  const odds = predicted === "HOME" ? snapH : predicted === "DRAW" ? snapD : snapA;
  if (!Number.isFinite(odds) || odds < 1.01) return 0;
  return odds - 1;
}

/**
 * Creates settlement rows for finished matches that have a non-mock prediction and no settlement yet.
 */
export async function settleFinishedMatches(prisma: PrismaClient): Promise<{ settled: number }> {
  const preds = await prisma.prediction.findMany({
    where: {
      mockContext: false,
      settlement: null,
      match: {
        status: "FT",
        homeScore: { not: null },
        awayScore: { not: null },
      },
    },
    include: {
      match: {
        include: {
          odds: { orderBy: { fetchedAt: "desc" }, take: 1 },
        },
      },
    },
  });

  let settled = 0;
  for (const p of preds) {
    const m = p.match;
    const hs = m.homeScore!;
    const ag = m.awayScore!;
    const actual = actual1x2FromScore(hs, ag);
    const predicted = p.outcomePrediction as Actual1x2;

    const ph = p.calibratedHome ?? p.probHome;
    const pd = p.calibratedDraw ?? p.probDraw;
    const pa = p.calibratedAway ?? p.probAway;
    const brier = brierTriplet(ph, pd, pa, actual);

    const o0 = m.odds[0];
    const snapH = p.snapshotHomeOdds ?? o0?.homeOdds;
    const snapD = p.snapshotDrawOdds ?? o0?.drawOdds;
    const snapA = p.snapshotAwayOdds ?? o0?.awayOdds;

    let profit = 0;
    if (snapH != null && snapD != null && snapA != null) {
      profit = flatProfitUnits(predicted, actual, snapH, snapD, snapA);
    }

    const exactScoreHit = p.exactScore === `${hs}-${ag}`;
    const totalG = hs + ag;
    const actualOver = totalG > 2.5;
    let ouHit: boolean | null = null;
    if (p.overUnderPrediction === "OVER") ouHit = actualOver;
    else if (p.overUnderPrediction === "UNDER") ouHit = !actualOver;
    else ouHit = null;

    const actualBtts = hs > 0 && ag > 0;
    let bttsHit: boolean | null = null;
    if (p.bttsPrediction === "YES") bttsHit = actualBtts;
    else if (p.bttsPrediction === "NO") bttsHit = !actualBtts;
    else bttsHit = null;

    await prisma.predictionSettlement.create({
      data: {
        predictionId: p.id,
        matchId: m.id,
        homeScore: hs,
        awayScore: ag,
        actual1x2: actual,
        predicted1x2: predicted,
        outcomeHit: predicted === actual,
        exactScoreHit,
        ouHit,
        bttsHit,
        brier1x2: brier,
        profitFlatUnits: profit,
      },
    });
    settled += 1;
  }

  return { settled };
}

export type PerformanceSlice = {
  n: number;
  outcomeHitRate: number | null;
  drawPickRate: number | null;
  drawAccuracy: number | null;
  exactScoreHitRate: number | null;
  ouHitRate: number | null;
  /** When model predicted YES/NO BTTS (excludes UNCERTAIN). */
  bttsHitRate: number | null;
  meanBrier: number | null;
  /** Mean flat 1u P&amp;L at snapshot 1X2 odds (same as ROI field in UI). */
  roiFlatUnits: number | null;
};

export type SliceRow = {
  outcomeHit: boolean;
  predicted1x2: string;
  actual1x2: string;
  exactScoreHit: boolean;
  ouHit: boolean | null;
  bttsHit: boolean | null;
  brier1x2: number;
  profitFlatUnits: number;
};

function sliceMetrics(rows: SliceRow[]): PerformanceSlice {
  const n = rows.length;
  if (n === 0) {
    return {
      n: 0,
      outcomeHitRate: null,
      drawPickRate: null,
      drawAccuracy: null,
      exactScoreHitRate: null,
      ouHitRate: null,
      bttsHitRate: null,
      meanBrier: null,
      roiFlatUnits: null,
    };
  }
  const hits = rows.filter((r) => r.outcomeHit).length;
  const drawPicks = rows.filter((r) => r.predicted1x2 === "DRAW");
  const drawHits = drawPicks.filter((r) => r.actual1x2 === "DRAW").length;
  const ouRows = rows.filter((r) => r.ouHit !== null);
  const ouHits = ouRows.filter((r) => r.ouHit === true).length;
  const bttsRows = rows.filter((r) => r.bttsHit !== null);
  const bttsHits = bttsRows.filter((r) => r.bttsHit === true).length;
  const meanBrier = rows.reduce((s, r) => s + r.brier1x2, 0) / n;
  const roi = rows.reduce((s, r) => s + r.profitFlatUnits, 0) / n;

  return {
    n,
    outcomeHitRate: hits / n,
    drawPickRate: drawPicks.length / n,
    drawAccuracy: drawPicks.length ? drawHits / drawPicks.length : null,
    exactScoreHitRate: rows.filter((r) => r.exactScoreHit).length / n,
    ouHitRate: ouRows.length ? ouHits / ouRows.length : null,
    bttsHitRate: bttsRows.length ? bttsHits / bttsRows.length : null,
    meanBrier,
    roiFlatUnits: roi,
  };
}

export type CalibrationBin = {
  binLabel: string;
  binMin: number;
  binMax: number;
  n: number;
  avgConfidence: number;
  outcomeHitRate: number;
};

/** Build confidence decile bins from actionable (non–NO BET) settled rows — same logic as platform performance. */
export function buildCalibrationBins(
  actionableSettlements: Array<{
    outcomeHit: boolean;
    prediction: { confidence: number };
  }>
): CalibrationBin[] {
  const calibration: CalibrationBin[] = [];
  for (let b = 0; b < 10; b++) {
    const binMin = b / 10;
    const binMax = (b + 1) / 10;
    const inBin = actionableSettlements.filter((s) => {
      const c = s.prediction.confidence;
      if (b === 9) return c >= binMin && c <= 1;
      return c >= binMin && c < binMax;
    });
    if (inBin.length === 0) continue;
    const hit = inBin.filter((s) => s.outcomeHit).length;
    const avgConf = inBin.reduce((sum, s) => sum + s.prediction.confidence, 0) / inBin.length;
    calibration.push({
      binLabel: `${(binMin * 100).toFixed(0)}–${(binMax * 100).toFixed(0)}%`,
      binMin,
      binMax,
      n: inBin.length,
      avgConfidence: avgConf,
      outcomeHitRate: hit / inBin.length,
    });
  }
  return calibration;
}

export async function getCalibrationBins(prisma: PrismaClient): Promise<CalibrationBin[]> {
  const settlements = await prisma.predictionSettlement.findMany({
    where: { prediction: { mockContext: false } },
    orderBy: { settledAt: "desc" },
    take: 500,
    include: { prediction: { select: { confidence: true, noBet: true } } },
  });
  const actionable = settlements.filter((s) => !s.prediction.noBet);
  return buildCalibrationBins(actionable);
}

export function findCalibrationBinForConfidence(confidence: number, bins: CalibrationBin[]): CalibrationBin | null {
  for (let b = 0; b < 10; b++) {
    const binMin = b / 10;
    const binMax = (b + 1) / 10;
    const inRange = b === 9 ? confidence >= binMin && confidence <= 1 : confidence >= binMin && confidence < binMax;
    if (!inRange) continue;
    const label = `${(binMin * 100).toFixed(0)}–${(binMax * 100).toFixed(0)}%`;
    return bins.find((x) => x.binLabel === label) ?? null;
  }
  return null;
}

export type MatchReliabilityLabel = "historically_strong" | "in_line" | "underperforming" | "low_sample";

export type MatchTrackContext = {
  insufficientHistory: boolean;
  /** Headline confidence as shown on the card (0–100). */
  headlineConfidencePct: number;
  mockExcluded: boolean;
  calibrationBin: {
    binLabel: string;
    avgConfidence: number;
    historical1x2HitRate: number;
    n: number;
    /** Realized hit rate minus average confidence in this bin (ex-post calibration gap). */
    calibrationGap: number;
  } | null;
  /** How this bin behaved vs confidence on past picks — null if not enough to label. */
  reliabilityLabel: MatchReliabilityLabel | null;
  note: string | null;
};

export async function getMatchTrackContext(
  prisma: PrismaClient,
  confidence: number,
  mockContext: boolean
): Promise<MatchTrackContext> {
  const headlineConfidencePct = Math.round(Math.min(1, Math.max(0, confidence)) * 100);
  if (mockContext) {
    return {
      insufficientHistory: true,
      headlineConfidencePct,
      mockExcluded: true,
      calibrationBin: null,
      reliabilityLabel: null,
      note: "Synthetic/demo path — excluded from public track record and calibration tables.",
    };
  }
  const totalSettled = await prisma.predictionSettlement.count({
    where: { prediction: { mockContext: false } },
  });
  if (totalSettled < MIN_HISTORY_FOR_PROOF) {
    return {
      insufficientHistory: true,
      headlineConfidencePct,
      mockExcluded: false,
      calibrationBin: null,
      reliabilityLabel: null,
      note: "Not enough settled history yet to show calibration vs past picks.",
    };
  }
  const bins = await getCalibrationBins(prisma);
  const bin = findCalibrationBinForConfidence(confidence, bins);
  if (!bin) {
    return {
      insufficientHistory: false,
      headlineConfidencePct,
      mockExcluded: false,
      calibrationBin: null,
      reliabilityLabel: "low_sample",
      note: "No settled picks in this confidence decile yet — bin will populate as more fixtures finish.",
    };
  }
  const gap = bin.outcomeHitRate - bin.avgConfidence;
  let reliabilityLabel: MatchReliabilityLabel | null;
  if (bin.n < TRACK_RECORD_MIN_N) {
    reliabilityLabel = "low_sample";
  } else if (gap > 0.08) {
    reliabilityLabel = "historically_strong";
  } else if (gap < -0.08) {
    reliabilityLabel = "underperforming";
  } else {
    reliabilityLabel = "in_line";
  }
  return {
    insufficientHistory: false,
    headlineConfidencePct,
    mockExcluded: false,
    calibrationBin: {
      binLabel: bin.binLabel,
      avgConfidence: bin.avgConfidence,
      historical1x2HitRate: bin.outcomeHitRate,
      n: bin.n,
      calibrationGap: gap,
    },
    reliabilityLabel,
    note: null,
  };
}

export type TrendPoint = {
  settledAt: string;
  /** Rolling hit rate over the previous `window` actionable settled picks (inclusive). */
  rollingHitRate: number;
  window: number;
};

export type EdgeVsOutcomeStats = {
  sampleSize: number;
  /** Pearson r between stored `valueScore` (edge proxy) and 1X2 hit — null if under 10 samples or zero variance. */
  pearsonR: number | null;
  /** By quintile of valueScore (low → high edge proxy). */
  quintiles: { label: string; n: number; avgValueScore: number; hitRate: number }[];
  note: string;
};

function pearsonValueScoreVsHit(rows: { valueScore: number; hit: number }[]): number | null {
  const n = rows.length;
  if (n < MIN_HISTORY_FOR_PROOF) return null;
  const xs = rows.map((r) => r.valueScore);
  const ys = rows.map((r) => r.hit);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  if (vx === 0 || vy === 0) return null;
  return cov / Math.sqrt(vx * vy);
}

function quintileEdgeBuckets(
  rows: { valueScore: number; outcomeHit: boolean }[]
): { label: string; n: number; avgValueScore: number; hitRate: number }[] {
  if (rows.length === 0) return [];
  const sorted = [...rows].sort((a, b) => a.valueScore - b.valueScore);
  const n = sorted.length;
  const out: { label: string; n: number; avgValueScore: number; hitRate: number }[] = [];
  const k = 5;
  for (let q = 0; q < k; q++) {
    const start = Math.floor((q * n) / k);
    const end = Math.floor(((q + 1) * n) / k);
    const slice = sorted.slice(start, end);
    if (slice.length === 0) continue;
    const hits = slice.filter((r) => r.outcomeHit).length;
    const avgVs = slice.reduce((s, r) => s + r.valueScore, 0) / slice.length;
    const label =
      q === 0 ? "Lowest quintile" : q === k - 1 ? "Highest quintile" : `Quintile ${q + 1}`;
    out.push({
      label,
      n: slice.length,
      avgValueScore: avgVs,
      hitRate: hits / slice.length,
    });
  }
  return out;
}

/**
 * Aggregates track-record stats from real (non-mock) settled predictions only.
 */
export async function computePlatformPerformance(prisma: PrismaClient): Promise<{
  note: string;
  totalSettled: number;
  /** True when fewer than MIN_HISTORY_FOR_PROOF settled rows exist — UI should show “insufficient history”. */
  insufficientHistory: boolean;
  last10: PerformanceSlice;
  last50: PerformanceSlice;
  last100: PerformanceSlice;
  actionableLast10: PerformanceSlice;
  actionableLast50: PerformanceSlice;
  actionableLast100: PerformanceSlice;
  calibration: CalibrationBin[];
  /** 0–100 from recent actionable hit rate vs naive baseline; null if not enough history. */
  platformTrustScore: number | null;
  /** Same inputs as live pipeline nudges — for transparency. */
  trackRecord: TrackRecordAdjustment;
  /** Rolling 15-game 1X2 hit rate at each of the last ≤40 settlement timestamps (oldest → newest). */
  trendRolling15: TrendPoint[];
  /** Most recent 20 actionable vs prior 20 (when both have n≥5). */
  trendRecentVsPrior: { recent20: PerformanceSlice; prior20: PerformanceSlice } | null;
  edgeVsOutcome: EdgeVsOutcomeStats;
}> {
  const totalSettled = await prisma.predictionSettlement.count({
    where: { prediction: { mockContext: false } },
  });

  const settlements = await prisma.predictionSettlement.findMany({
    where: { prediction: { mockContext: false } },
    orderBy: { settledAt: "desc" },
    take: 500,
    include: {
      prediction: {
        select: {
          confidence: true,
          noBet: true,
          valueScore: true,
        },
      },
    },
  });

  const toSlice = (s: (typeof settlements)[0]): SliceRow => ({
    outcomeHit: s.outcomeHit,
    predicted1x2: s.predicted1x2,
    actual1x2: s.actual1x2,
    exactScoreHit: s.exactScoreHit,
    ouHit: s.ouHit,
    bttsHit: s.bttsHit,
    brier1x2: s.brier1x2,
    profitFlatUnits: s.profitFlatUnits,
  });

  const rows = settlements.map(toSlice);

  const insufficientHistory = totalSettled < MIN_HISTORY_FOR_PROOF;

  const last10 = sliceMetrics(rows.slice(0, 10));
  const last50 = sliceMetrics(rows.slice(0, 50));
  const last100 = sliceMetrics(rows.slice(0, 100));

  const actionableSettlements = settlements.filter((s) => !s.prediction.noBet);
  const actionableLast10 = sliceMetrics(actionableSettlements.slice(0, 10).map(toSlice));
  const actionableLast50 = sliceMetrics(actionableSettlements.slice(0, 50).map(toSlice));
  const actionableLast100 = sliceMetrics(actionableSettlements.slice(0, 100).map(toSlice));

  const edgeSource = actionableSettlements.slice(0, 200).map((s) => ({
    valueScore: s.prediction.valueScore,
    outcomeHit: s.outcomeHit,
  }));
  const pearsonRows = edgeSource.map((r) => ({
    valueScore: r.valueScore,
    hit: r.outcomeHit ? 1 : 0,
  }));
  const edgeVsOutcome: EdgeVsOutcomeStats = {
    sampleSize: edgeSource.length,
    pearsonR: pearsonValueScoreVsHit(pearsonRows),
    quintiles: quintileEdgeBuckets(edgeSource),
    note:
      "valueScore is the max-edge proxy stored on each prediction. Correlation and quintiles describe whether higher scored edges tended to win 1X2 more often after full time — descriptive ex-post validation, not a live trading signal.",
  };

  const calibration = buildCalibrationBins(
    actionableSettlements.map((s) => ({
      outcomeHit: s.outcomeHit,
      prediction: { confidence: s.prediction.confidence },
    }))
  );

  const trackRecord = await getTrackRecordAdjustment(prisma);
  let platformTrustScore: number | null = null;
  if (trackRecord.sampleSize >= TRACK_RECORD_MIN_N && trackRecord.hitRate != null) {
    const gap = trackRecord.hitRate - NAIVE_BASELINE_1X2;
    platformTrustScore = clamp(50 + gap * 150, 15, 85);
  }

  const forTrend = await prisma.predictionSettlement.findMany({
    where: { prediction: { mockContext: false, noBet: false } },
    orderBy: { settledAt: "desc" },
    take: 120,
    select: { settledAt: true, outcomeHit: true },
  });
  const chronological = [...forTrend].reverse();
  const WINDOW = 15;
  const trendRolling15: TrendPoint[] = [];
  for (let i = WINDOW - 1; i < chronological.length; i++) {
    const slice = chronological.slice(i - (WINDOW - 1), i + 1);
    const hr = slice.filter((x) => x.outcomeHit).length / WINDOW;
    const last = slice[WINDOW - 1]!;
    trendRolling15.push({
      settledAt: last.settledAt.toISOString(),
      rollingHitRate: hr,
      window: WINDOW,
    });
  }

  let trendRecentVsPrior: { recent20: PerformanceSlice; prior20: PerformanceSlice } | null = null;
  const desc40 = await prisma.predictionSettlement.findMany({
    where: { prediction: { mockContext: false, noBet: false } },
    orderBy: { settledAt: "desc" },
    take: 40,
    include: {
      prediction: { select: { confidence: true, noBet: true, valueScore: true } },
    },
  });
  if (desc40.length >= 10) {
    const recentSlice = desc40.slice(0, 20).map(toSlice);
    const priorSlice = desc40.slice(20, 40).map(toSlice);
    trendRecentVsPrior = {
      recent20: sliceMetrics(recentSlice),
      prior20: sliceMetrics(priorSlice),
    };
  }

  return {
    note:
      "Counts only settled fixtures with real book-matched odds at prediction time (mock/demo runs excluded). ROI uses flat 1u stakes at stored 1X2 decimals. Last 10/50/100 slices use the most recent settlements in the DB (up to 500 loaded). BTTS/O-U rates include only rows where the model took a side (not UNCERTAIN). Platform trust score maps recent actionable hit rate vs a naive 1/3 baseline — descriptive, not investment advice.",
    totalSettled,
    insufficientHistory,
    last10,
    last50,
    last100,
    actionableLast10,
    actionableLast50,
    actionableLast100,
    calibration,
    platformTrustScore,
    trackRecord,
    trendRolling15,
    trendRecentVsPrior,
    edgeVsOutcome,
  };
}

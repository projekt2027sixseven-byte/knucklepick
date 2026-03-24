/** Mirrors GET /api/insights/performance — real settled data only. */

/** Must match `MIN_HISTORY_FOR_PROOF` in predictionSettlement (server). */
export const MIN_HISTORY_FOR_PROOF = 10;

/** Must match `TRACK_RECORD_MIN_N` on server — minimum n before tier labels. */
export const TRACK_RECORD_MIN_N = 8;

/** Naive 1X2 baseline — mirrors server `NAIVE_BASELINE_1X2` for UI copy. */
export const NAIVE_BASELINE_1X2 = 1 / 3;

export type MatchReliabilityLabel = "historically_strong" | "in_line" | "underperforming" | "low_sample";

export type MatchTrackContext = {
  insufficientHistory: boolean;
  headlineConfidencePct: number;
  /** True when prediction used demo/synthetic path — excluded from public stats. */
  mockExcluded: boolean;
  calibrationBin: {
    binLabel: string;
    avgConfidence: number;
    historical1x2HitRate: number;
    n: number;
    calibrationGap: number;
  } | null;
  reliabilityLabel: MatchReliabilityLabel | null;
  note: string | null;
};

export type PerformanceSlice = {
  n: number;
  outcomeHitRate: number | null;
  drawPickRate: number | null;
  drawAccuracy: number | null;
  exactScoreHitRate: number | null;
  ouHitRate: number | null;
  bttsHitRate: number | null;
  meanBrier: number | null;
  roiFlatUnits: number | null;
};

export type TrackRecordPayload = {
  sampleSize: number;
  hitRate: number | null;
  naiveBaseline: number;
  confidenceDelta: number;
  trustDelta: number;
};

export type TrendPoint = {
  settledAt: string;
  rollingHitRate: number;
  window: number;
};

export type EdgeVsOutcomeStats = {
  sampleSize: number;
  pearsonR: number | null;
  quintiles: { label: string; n: number; avgValueScore: number; hitRate: number }[];
  note: string;
};

export type PerformancePayload = {
  note: string;
  totalSettled: number;
  insufficientHistory: boolean;
  last10: PerformanceSlice;
  last50: PerformanceSlice;
  last100: PerformanceSlice;
  actionableLast10: PerformanceSlice;
  actionableLast50: PerformanceSlice;
  actionableLast100: PerformanceSlice;
  calibration: {
    binLabel: string;
    binMin: number;
    binMax: number;
    n: number;
    avgConfidence: number;
    outcomeHitRate: number;
  }[];
  platformTrustScore: number | null;
  trackRecord: TrackRecordPayload;
  trendRolling15: TrendPoint[];
  trendRecentVsPrior: { recent20: PerformanceSlice; prior20: PerformanceSlice } | null;
  edgeVsOutcome: EdgeVsOutcomeStats;
};

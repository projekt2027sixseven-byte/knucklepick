import { impliedProbabilities } from "../utils/math";
import {
  EDGE_HIGH_MIN_PROB,
  EDGE_MEDIUM_MIN_PROB,
  MIN_CONFIDENCE_STRONG_SIGNAL,
  MIN_TRUST_STRONG_SIGNAL,
} from "../constants/edge";

export type EdgeLabel = "HIGH" | "MEDIUM" | "NO_EDGE";

export type EdgeDetectionResult = {
  marketImplied: { home: number; draw: number; away: number };
  modelProbs: { home: number; draw: number; away: number };
  /** (model − market) × 100 for each 1X2 outcome — edge % in percentage points. */
  edgePctHome: number;
  edgePctDraw: number;
  edgePctAway: number;
  /** Same as edge on the model’s displayed lean (1X2 pick). */
  edgeOnDisplayedPickPct: number;
  /** Largest signed edge across outcomes (model − market), probability mass. */
  maxEdgeProb: number;
  edgeLabel: EdgeLabel;
  /** True when the fixture clears confidence + trust gates and is not NO BET. */
  strongSignal: boolean;
  /** True when edge is meaningful (MEDIUM or HIGH) and strongSignal — safe to surface on decision rails. */
  surfaceEligible: boolean;
};

function normalizeTriplet(h: number, d: number, a: number): { h: number; d: number; a: number } {
  const s = h + d + a;
  if (!Number.isFinite(s) || s <= 0) return { h: 1 / 3, d: 1 / 3, a: 1 / 3 };
  return { h: h / s, d: d / s, a: a / s };
}

/**
 * De-vigged market implied vs model (calibrated if present) for all three 1X2 outcomes.
 */
export function computeEdgeDetection(
  homeOdds: number,
  drawOdds: number,
  awayOdds: number,
  calibratedHome: number | null,
  calibratedDraw: number | null,
  calibratedAway: number | null,
  probHome: number,
  probDraw: number,
  probAway: number,
  outcomePrediction: string,
  confidence: number,
  trustIndex: number,
  noBet: boolean
): EdgeDetectionResult {
  const imp = impliedProbabilities(homeOdds, drawOdds, awayOdds);
  const raw = normalizeTriplet(
    calibratedHome ?? probHome,
    calibratedDraw ?? probDraw,
    calibratedAway ?? probAway
  );
  const mH = raw.h;
  const mD = raw.d;
  const mA = raw.a;

  const dh = mH - imp.home;
  const dd = mD - imp.draw;
  const da = mA - imp.away;

  const edgePctHome = dh * 100;
  const edgePctDraw = dd * 100;
  const edgePctAway = da * 100;
  const maxEdgeProb = Math.max(dh, dd, da);

  const pickEdge =
    outcomePrediction === "HOME" ? dh : outcomePrediction === "DRAW" ? dd : outcomePrediction === "AWAY" ? da : dh;
  const edgeOnDisplayedPickPct = pickEdge * 100;

  let edgeLabel: EdgeLabel = "NO_EDGE";
  if (maxEdgeProb >= EDGE_HIGH_MIN_PROB) edgeLabel = "HIGH";
  else if (maxEdgeProb >= EDGE_MEDIUM_MIN_PROB) edgeLabel = "MEDIUM";

  const strongSignal =
    !noBet && confidence >= MIN_CONFIDENCE_STRONG_SIGNAL && trustIndex >= MIN_TRUST_STRONG_SIGNAL;

  const surfaceEligible =
    strongSignal && (edgeLabel === "HIGH" || edgeLabel === "MEDIUM");

  return {
    marketImplied: { home: imp.home, draw: imp.draw, away: imp.away },
    modelProbs: { home: mH, draw: mD, away: mA },
    edgePctHome,
    edgePctDraw,
    edgePctAway,
    edgeOnDisplayedPickPct,
    maxEdgeProb,
    edgeLabel,
    strongSignal,
    surfaceEligible,
  };
}

/** Sort key: edge strength, then confidence, then trust (all descending). */
export function compareEdgeRank(
  a: { maxEdgeProb?: number; confidence?: number; trustIndex?: number },
  b: { maxEdgeProb?: number; confidence?: number; trustIndex?: number }
): number {
  const ea = a.maxEdgeProb ?? -999;
  const eb = b.maxEdgeProb ?? -999;
  if (eb !== ea) return eb - ea;
  const ca = a.confidence ?? 0;
  const cb = b.confidence ?? 0;
  if (cb !== ca) return cb - ca;
  const ta = a.trustIndex ?? 0;
  const tb = b.trustIndex ?? 0;
  return tb - ta;
}


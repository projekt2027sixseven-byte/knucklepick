/**
 * Backtest / offline evaluation hooks — structure only (no historical replay wired yet).
 * Use these signatures when you plug in a calibration dataset or paper-trading log.
 */

export type LabeledOutcome = "HOME" | "DRAW" | "AWAY";

export function brierScoreTriplet(
  predicted: { pHome: number; pDraw: number; pAway: number },
  actual: LabeledOutcome
): number {
  const y = { HOME: [1, 0, 0], DRAW: [0, 1, 0], AWAY: [0, 0, 1] }[actual];
  const p = [predicted.pHome, predicted.pDraw, predicted.pAway];
  let s = 0;
  for (let i = 0; i < 3; i++) s += (p[i]! - y[i]!) ** 2;
  return s / 3;
}

export function logLossTriplet(
  predicted: { pHome: number; pDraw: number; pAway: number },
  actual: LabeledOutcome
): number {
  const idx = actual === "HOME" ? 0 : actual === "DRAW" ? 1 : 2;
  const p = [predicted.pHome, predicted.pDraw, predicted.pAway][idx]!;
  return -Math.log(Math.max(1e-9, p));
}

export type BacktestRecord = {
  matchId: string;
  modelVersion: string;
  predicted: { pHome: number; pDraw: number; pAway: number };
  calibrated?: { cHome: number; cDraw: number; cAway: number };
  outcome?: LabeledOutcome;
  closingOdds?: { home: number; draw: number; away: number };
};

import type { TotalGoalsBand } from "../utils/ouInference";

/** Structural 1X2 shape from de-vigged implieds (team-agnostic). */
export type OddsBand = "HEAVY_HOME" | "HEAVY_AWAY" | "DRAW_HEAVY" | "BALANCED";

export function classifyOddsBand(implied: { home: number; draw: number; away: number }): OddsBand {
  const { home: h, draw: d, away: a } = implied;
  const max = Math.max(h, d, a);
  const arr = [h, d, a].sort((x, y) => y - x);
  const gap = arr[0]! - arr[1]!;
  if (d >= 0.33 && d >= max - 0.04) return "DRAW_HEAVY";
  if (gap < 0.052) return "BALANCED";
  if (h === max && h >= 0.4) return "HEAVY_HOME";
  if (a === max && a >= 0.4) return "HEAVY_AWAY";
  return "BALANCED";
}

export function bandMismatch(a: OddsBand, b: OddsBand): number {
  return a === b ? 0 : 1;
}

export function totalBandMismatch(a: TotalGoalsBand, b: TotalGoalsBand): number {
  if (a === b) return 0;
  const order: Record<TotalGoalsBand, number> = { LOW: 0, MID: 1, HIGH: 2 };
  return Math.abs(order[a] - order[b]) / 2;
}

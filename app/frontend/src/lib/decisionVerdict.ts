import { edgeLabelDisplay, type EdgeLabel } from "@/components/EdgeLabelBadge";

export type DecisionVerdict = "TAKE" | "AVOID" | "WATCH";

export type DecisionRail = "signal" | "edge" | "trap" | "avoid";

/** Maps dashboard rail to an unambiguous user verdict. */
export function verdictFromRail(rail: DecisionRail | undefined): DecisionVerdict {
  if (rail === "trap" || rail === "avoid") return "AVOID";
  if (rail === "signal") return "WATCH";
  return "TAKE";
}

type Pred = {
  outcomePrediction: string;
  confidence: number;
  valueScore: number;
  edgeOnPickPct?: number | null;
  noBet: boolean;
  trapMatch: boolean;
  edgeLabel?: EdgeLabel | null;
};

/** Single-line signal for cards: HIGH EDGE / MEDIUM EDGE / TRAP / NO BET / WATCH. */
export function shortDecisionLabel(
  prediction: Pred | null | undefined,
  rail: DecisionRail | undefined
): string {
  if (!prediction) return "—";
  if (prediction.noBet) return "NO BET";
  if (prediction.trapMatch) return "TRAP";
  if (rail === "signal") return "WATCH";
  return edgeLabelDisplay(prediction.edgeLabel as EdgeLabel | null);
}

export function edgePercentDisplay(prediction: Pred): string {
  if (prediction.edgeOnPickPct != null && Number.isFinite(prediction.edgeOnPickPct)) {
    const v = prediction.edgeOnPickPct;
    return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
  }
  return `${(prediction.valueScore * 100).toFixed(1)}%`;
}

export function confidencePercentDisplay(prediction: Pred): number {
  return Math.round(Math.min(1, Math.max(0, prediction.confidence)) * 100);
}

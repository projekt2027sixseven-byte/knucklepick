"use client";

/** Mirrors backend `EdgeLabel` from edge-detection engine. */
export type EdgeLabel = "HIGH" | "MEDIUM" | "NO_EDGE";

/** Display strings matching product spec (HIGH EDGE / MEDIUM EDGE / NO EDGE). */
export function edgeLabelDisplay(edgeLabel?: EdgeLabel | null): string {
  const key: EdgeLabel = edgeLabel ?? "NO_EDGE";
  const map: Record<EdgeLabel, string> = {
    HIGH: "HIGH EDGE",
    MEDIUM: "MEDIUM EDGE",
    NO_EDGE: "NO EDGE",
  };
  return map[key];
}

const styles: Record<EdgeLabel, string> = {
  HIGH:
    "border-emerald-400/45 bg-emerald-500/15 text-emerald-100 shadow-[0_0_20px_rgba(52,211,153,0.2)]",
  MEDIUM:
    "border-amber-400/40 bg-amber-500/12 text-amber-100/95",
  NO_EDGE: "border-slate-500/40 bg-slate-800/50 text-slate-400",
};

export function EdgeLabelBadge({ edgeLabel }: { edgeLabel?: EdgeLabel | null }) {
  const key: EdgeLabel = edgeLabel ?? "NO_EDGE";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] ${styles[key]}`}
      title="Model vs de-vig market — max 1X2 edge tier"
    >
      {edgeLabelDisplay(edgeLabel)}
    </span>
  );
}

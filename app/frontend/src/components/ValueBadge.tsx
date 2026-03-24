"use client";

/** Max raw 1X2 edge (model vs implied) — legacy `valueScore` from engine. */
export function ValueBadge({
  valueScore,
  edgeOnPickPct,
}: {
  valueScore: number;
  /** When set, shows edge on the model’s pick vs market (primary UX). */
  edgeOnPickPct?: number | null;
}) {
  const usePick = edgeOnPickPct != null && Number.isFinite(edgeOnPickPct);
  const display = usePick ? edgeOnPickPct : valueScore * 100;
  const pos = display >= 0;
  const label = usePick ? "Pick edge" : "Max edge";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide shadow-[0_0_16px_rgba(34,211,238,0.12)] ${
        pos
          ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
          : "border-slate-500/35 bg-slate-500/10 text-slate-300"
      }`}
    >
      {label} {pos ? "+" : ""}
      {display.toFixed(1)}%
    </span>
  );
}

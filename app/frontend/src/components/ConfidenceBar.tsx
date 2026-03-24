"use client";

export function ConfidenceBar({ value, size = "md" }: { value: number; size?: "md" | "lg" }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const h = size === "lg" ? "h-3.5" : "h-2.5";
  const label = size === "lg" ? "text-xs" : "text-[11px]";

  return (
    <div className="w-full">
      <div className={`mb-2 flex justify-between ${label} font-medium uppercase tracking-wider text-slate-500`}>
        <span>Confidence</span>
        <span className="tabular-nums font-bold text-fuchsia-100">{pct}%</span>
      </div>
      <div
        className={`${h} relative overflow-hidden rounded-full bg-white/[0.08] ring-1 ring-fuchsia-500/25`}
      >
        <div
          className="confidence-bar-fill relative h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-400 to-cyan-300 shadow-[0_0_18px_rgba(232,121,249,0.45)] transition-[width] duration-700 ease-out animate-bar-glow"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

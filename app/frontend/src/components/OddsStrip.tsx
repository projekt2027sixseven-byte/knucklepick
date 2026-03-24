"use client";

export type OddsStripProps = {
  home: number;
  draw: number;
  away: number;
  /** compact = single line; dense = slightly larger for hero */
  variant?: "compact" | "default" | "dense";
  bookmaker?: string | null;
  className?: string;
};

function fmt(n: number) {
  return n >= 10 ? n.toFixed(1) : n.toFixed(2);
}

export function OddsStrip({ home, draw, away, variant = "default", bookmaker, className = "" }: OddsStripProps) {
  const text =
    variant === "dense"
      ? "font-display text-lg font-bold tabular-nums tracking-tight md:text-xl"
      : variant === "compact"
        ? "text-[11px] font-bold tabular-nums"
        : "text-sm font-bold tabular-nums";
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">1X2</span>
      <div className={`flex items-center gap-2 rounded-xl border border-white/[0.1] bg-black/25 px-2.5 py-1 text-white ${text}`}>
        <span className="text-cyan-200/95">{fmt(home)}</span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-200">{fmt(draw)}</span>
        <span className="text-slate-600">·</span>
        <span className="text-fuchsia-200/95">{fmt(away)}</span>
      </div>
      {bookmaker ? (
        <span className="text-[9px] font-medium uppercase tracking-wider text-slate-600">{bookmaker}</span>
      ) : null}
    </div>
  );
}

const map: Record<string, string> = {
  LOW: "border-cyan-400/40 bg-cyan-500/12 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.15)]",
  MEDIUM: "bg-amber-500/12 text-amber-200 border-amber-400/35",
  HIGH: "bg-orange-500/15 text-orange-200 border-orange-500/35",
  EXTREME: "bg-rose-600/18 text-rose-200 border-rose-500/45",
};

export function RiskBadge({ level }: { level: string }) {
  const cls = map[level] ?? "bg-white/10 text-slate-200 border-white/20";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${cls}`}>
      Risk {level}
    </span>
  );
}

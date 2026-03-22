const map: Record<string, string> = {
  LOW: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  HIGH: "bg-orange-500/15 text-orange-200 border-orange-500/30",
  EXTREME: "bg-rose-600/20 text-rose-200 border-rose-500/40",
};

export function RiskBadge({ level }: { level: string }) {
  const cls = map[level] ?? "bg-white/10 text-slate-200 border-white/20";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      Risk: {level}
    </span>
  );
}

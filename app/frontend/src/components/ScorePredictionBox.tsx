export function ScorePredictionBox({
  exact,
  alt,
  xgHome,
  xgAway,
}: {
  exact: string;
  alt?: string | null;
  xgHome: number;
  xgAway: number;
}) {
  return (
    <div className="glass-strong relative grid gap-6 overflow-hidden rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-500/[0.1] via-transparent to-cyan-500/[0.08] p-5 shadow-glow md:grid-cols-2 md:p-6">
      <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">Exact score</p>
        <p className="mt-2 font-display text-4xl font-black tabular-nums tracking-tight text-amber-200 drop-shadow-lg md:text-5xl">
          {exact}
        </p>
        {alt ? <p className="mt-2 text-sm text-slate-500">Alt · {alt}</p> : null}
      </div>
      <div className="relative sm:border-l sm:border-white/[0.08] sm:pl-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">Expected goals (xG)</p>
        <p className="mt-2 bg-gradient-to-r from-fuchsia-200 to-cyan-300 bg-clip-text font-display text-3xl font-black tabular-nums text-transparent md:text-4xl">
          {xgHome.toFixed(2)} <span className="text-2xl font-normal text-slate-600">—</span> {xgAway.toFixed(2)}
        </p>
        <p className="mt-2 text-xs text-slate-500">Poisson-weighted rates · model lab</p>
      </div>
    </div>
  );
}

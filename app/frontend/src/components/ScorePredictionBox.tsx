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
    <div className="glass rounded-2xl p-4 grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">Exact score</p>
        <p className="text-3xl font-semibold text-oracle.gold mt-1">{exact}</p>
        {alt ? <p className="text-sm text-slate-400 mt-1">Alt: {alt}</p> : null}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">Expected goals</p>
        <p className="text-2xl font-semibold mt-1">
          {xgHome.toFixed(2)} — {xgAway.toFixed(2)}
        </p>
        <p className="text-sm text-slate-400 mt-1">Poisson-weighted rates</p>
      </div>
    </div>
  );
}

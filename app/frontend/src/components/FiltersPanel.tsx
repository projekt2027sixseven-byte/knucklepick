"use client";

export function FiltersPanel({
  leagueId,
  onLeagueChange,
}: {
  leagueId: string;
  onLeagueChange: (v: string) => void;
}) {
  return (
    <div className="glass rounded-2xl p-4 md:p-5 border border-white/10 flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:items-end">
      <div className="flex-1 min-w-[220px]">
        <label htmlFor="league-filter" className="block text-xs font-medium uppercase tracking-wider text-slate-500">
          League filter
        </label>
        <input
          id="league-filter"
          value={leagueId}
          onChange={(e) => onLeagueChange(e.target.value)}
          placeholder="Internal league ID (optional)"
          className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
        />
        <p className="text-[11px] text-slate-600 mt-1.5">Narrow the warehouse — signal & value rails stay global.</p>
      </div>
    </div>
  );
}

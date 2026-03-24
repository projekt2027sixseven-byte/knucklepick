"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type LeaguesPayload = {
  leagues: { id: string; name: string; country: string | null }[];
};

export function FiltersPanel({
  leagueId,
  onLeagueChange,
}: {
  leagueId: string;
  onLeagueChange: (v: string) => void;
}) {
  const q = useQuery({
    queryKey: ["meta-leagues"],
    queryFn: () => apiFetch<LeaguesPayload>("/api/meta/leagues"),
    staleTime: 60_000,
    retry: 1,
  });

  const leagues = q.data?.leagues ?? [];

  return (
    <div className="dream-panel flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:flex-wrap sm:items-end md:p-5">
      <div className="flex-1 min-w-[220px]">
        <label htmlFor="league-filter" className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          League filter
        </label>
        {q.isError ? (
          <input
            id="league-filter"
            value={leagueId}
            onChange={(e) => onLeagueChange(e.target.value)}
            placeholder="Paste league ID if you have one"
            className="mt-2 w-full rounded-xl border border-amber-500/25 bg-dream-ink/80 px-3 py-2.5 font-mono text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/35"
          />
        ) : (
          <select
            id="league-filter"
            value={leagueId}
            onChange={(e) => onLeagueChange(e.target.value)}
            disabled={q.isLoading}
            className="mt-2 w-full rounded-xl border border-white/12 bg-dream-ink/80 px-3 py-2.5 text-sm text-white transition-shadow focus:border-fuchsia-400/25 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/35 disabled:opacity-50"
          >
            <option value="">All leagues</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.country ? ` · ${l.country}` : ""}
              </option>
            ))}
          </select>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <p className="text-[11px] text-slate-600">
            {q.isError
              ? "Could not load the league list — retry or paste a league ID you already know."
              : "Narrow the deck — edges and value rails stay the same; you only filter which fixtures appear."}
          </p>
          {q.isError ? (
            <button
              type="button"
              onClick={() => void q.refetch()}
              className="text-[11px] font-semibold text-fuchsia-300 hover:text-fuchsia-200"
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

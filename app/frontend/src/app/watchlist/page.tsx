"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";

type Item = {
  id: string;
  note?: string | null;
  match: {
    id: string;
    utcDate: string;
    homeTeam: { name: string };
    awayTeam: { name: string };
    league?: { name: string } | null;
    predictions: { outcomePrediction: string; trustIndex: number; exactScore: string }[];
  };
};

export default function WatchlistPage() {
  const token = useAuthStore((s) => s.token);
  const q = useQuery({
    queryKey: ["watchlist", token],
    enabled: Boolean(token),
    queryFn: () => apiFetch<{ items: Item[] }>("/api/watchlist", { token }),
  });

  if (!token) {
    return (
      <EmptyState
        title="Watchlist is for signed-in analysts"
        description="Pin fixtures from the intelligence grid to monitor kickoff windows, trust shifts, and line moves in one place."
        action={{ label: "Sign in", href: "/account" }}
        secondary={{ label: "Explore grid", href: "/dashboard" }}
      />
    );
  }
  if (q.isLoading) {
    return (
      <div className="space-y-4 animate-pulse max-w-2xl">
        <div className="h-10 w-48 rounded-lg bg-white/10" />
        <div className="h-28 rounded-2xl bg-white/5" />
        <div className="h-28 rounded-2xl bg-white/5" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <EmptyState
        title="Couldn’t load watchlist"
        description={(q.error as Error).message}
        action={{ label: "Try again", href: "/watchlist" }}
      />
    );
  }

  const items = q.data?.items ?? [];

  return (
    <div className="space-y-10 pb-8 max-w-3xl">
      <div>
        <p className="page-eyebrow">Monitoring</p>
        <h1 className="page-title mt-2">Watchlist</h1>
        <p className="text-slate-400 mt-3 leading-relaxed">
          Your shortlist for today’s sweep — open any match for full calibrated breakdowns.
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No fixtures pinned yet"
          description="From the intelligence grid or any match card, add fixtures here for faster review before kickoff."
          action={{ label: "Open intelligence grid", href: "/dashboard" }}
        />
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const p = it.match.predictions[0];
            return (
              <div
                key={it.id}
                className="card-premium p-5 flex flex-wrap justify-between gap-4 items-start"
              >
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{it.match.league?.name ?? "Fixture"}</p>
                  <Link
                    href={`/match/${it.match.id}`}
                    className="text-lg font-semibold text-white hover:text-cyan-200 transition-colors block truncate"
                  >
                    {it.match.homeTeam.name} <span className="text-slate-600">vs</span> {it.match.awayTeam.name}
                  </Link>
                  <p className="text-xs text-slate-500 mt-1.5">
                    {new Date(it.match.utcDate).toLocaleString()}
                  </p>
                  {it.note ? <p className="text-sm text-slate-400 mt-3 border-l-2 border-cyan-500/30 pl-3">{it.note}</p> : null}
                </div>
                {p ? (
                  <div className="text-right text-sm shrink-0">
                    <p className="text-amber-200 font-semibold">{p.outcomePrediction}</p>
                    <p className="text-xs text-slate-500 mt-1">Score {p.exactScore}</p>
                    <p className="text-xs text-cyan-200/90 mt-2">Trust {Math.round(p.trustIndex)}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

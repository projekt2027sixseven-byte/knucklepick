"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { formatRelativeShort } from "@/lib/formatRelative";

type Item = {
  id: string;
  note?: string | null;
  match: {
    id: string;
    utcDate: string;
    homeTeam: { name: string };
    awayTeam: { name: string };
    league?: { name: string } | null;
    predictions: {
      outcomePrediction: string;
      trustIndex: number;
      exactScore: string;
      confidence?: number;
      edgeOnPickPctDeltaPrev?: number | null;
      createdAt?: string;
    }[];
  };
};

export default function WatchlistPage() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["watchlist", token],
    enabled: Boolean(token),
    queryFn: () => apiFetch<{ items: Item[] }>("/api/watchlist", { token }),
    retry: 1,
  });

  const remove = useMutation({
    mutationFn: async (matchId: string) => {
      await apiFetch(`/api/watchlist/${matchId}`, { method: "DELETE", token: token! });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["watchlist"] });
      void qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });

  if (!token) {
    return (
      <EmptyState
        title="Watchlist is for signed-in analysts"
        description="Pin fixtures from the deck to monitor kickoff windows, trust shifts, and line moves in one place."
        action={{ label: "Sign in", href: "/account" }}
        secondary={{ label: "Open deck", href: "/dashboard" }}
      />
    );
  }
  if (q.isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="h-10 w-48 rounded-lg skeleton-shimmer border border-white/[0.06]" />
        <div className="h-28 rounded-2xl skeleton-shimmer border border-white/[0.06]" />
        <div className="h-28 rounded-2xl skeleton-shimmer border border-white/[0.06]" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <EmptyState
        title="Couldn’t load watchlist"
        description={(q.error as Error).message}
        retry={() => void q.refetch()}
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
          Pinned fixtures surface line moves: we highlight when edge shifts meaningfully between model runs — check back
          after each ingest.
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No fixtures pinned yet"
          description="From the deck or any match card, add fixtures here for faster review before kickoff."
          action={{ label: "Open deck", href: "/dashboard" }}
        />
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const p = it.match.predictions[0];
            const edgeAlert =
              p?.edgeOnPickPctDeltaPrev != null && Math.abs(p.edgeOnPickPctDeltaPrev) >= 0.35;
            return (
              <div
                key={it.id}
                className={`card-premium p-5 md:p-6 flex flex-wrap justify-between gap-4 items-start border border-white/[0.06] ring-1 ring-inset ring-fuchsia-500/25 shadow-[0_0_28px_rgba(232,121,249,0.08)]`}
              >
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{it.match.league?.name ?? "Fixture"}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-fuchsia-300/90">Tracked</span>
                    {edgeAlert ? (
                      <span className="rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-100">
                        Edge moved — review
                      </span>
                    ) : null}
                  </div>
                  <Link
                    href={`/match/${it.match.id}`}
                    className="block truncate font-display text-lg font-bold text-white transition-colors hover:text-fuchsia-200"
                  >
                    {it.match.homeTeam.name} <span className="font-normal text-slate-600">v</span>{" "}
                    {it.match.awayTeam.name}
                  </Link>
                  <p className="mt-1.5 text-xs text-slate-500">{new Date(it.match.utcDate).toLocaleString()}</p>
                  {p?.createdAt ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Model {formatRelativeShort(p.createdAt)}
                      {p.edgeOnPickPctDeltaPrev != null && Math.abs(p.edgeOnPickPctDeltaPrev) >= 0.2 ? (
                        <span className="text-cyan-200/90">
                          {" "}
                          · edge {p.edgeOnPickPctDeltaPrev >= 0 ? "+" : ""}
                          {p.edgeOnPickPctDeltaPrev.toFixed(1)}pp
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                  {it.note ? (
                    <p className="mt-3 border-l-2 border-fuchsia-500/40 pl-3 text-sm text-slate-400">{it.note}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right text-sm">
                  {p ? (
                    <>
                      <p className="font-bold text-amber-200">{p.outcomePrediction}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Score{" "}
                        <span className="align-middle font-mono text-xl font-black tabular-nums text-white">{p.exactScore}</span>
                      </p>
                      <p className="mt-2 text-xs font-semibold tabular-nums text-fuchsia-200/95">
                        Trust {Math.round(p.trustIndex)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">No model line yet</p>
                  )}
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(it.match.id)}
                    className="mt-3 text-xs font-semibold text-rose-300/90 hover:text-rose-200 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

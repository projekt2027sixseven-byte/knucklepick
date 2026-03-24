"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";

type Settlement = {
  outcomeHit: boolean;
  profitFlatUnits: number;
  exactScoreHit: boolean;
  actual1x2: string;
  homeScore: number;
  awayScore: number;
};

type Pick = {
  id: string;
  label?: string | null;
  status: string;
  snapshot: Record<string, unknown>;
  match: {
    id: string;
    utcDate: string;
    status?: string;
    homeScore?: number | null;
    awayScore?: number | null;
    homeTeam: { name: string };
    awayTeam: { name: string };
    league?: { name: string } | null;
    predictions: {
      outcomePrediction: string;
      settlement?: Settlement | null;
    }[];
  };
};

export default function PicksPage() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["picks", token],
    enabled: Boolean(token),
    queryFn: () => apiFetch<{ picks: Pick[] }>("/api/picks", { token }),
    retry: 1,
  });

  async function remove(id: string) {
    if (!token) return;
    await apiFetch(`/api/picks/${id}`, { method: "DELETE", token });
    await qc.invalidateQueries({ queryKey: ["picks"] });
  }

  if (!token) {
    return (
      <EmptyState
        title="Vault stores your pick snapshots"
        description="Freeze model confidence, trust, and book context at save time — ideal for post-match review and process discipline."
        action={{ label: "Sign in", href: "/account" }}
        secondary={{ label: "Browse matches", href: "/dashboard" }}
      />
    );
  }
  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-40 rounded-lg skeleton-shimmer border border-white/[0.06]" />
        <div className="h-40 rounded-2xl skeleton-shimmer border border-white/[0.06]" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <EmptyState
        title="Couldn’t open vault"
        description={(q.error as Error).message}
        retry={() => void q.refetch()}
      />
    );
  }

  const picks = q.data?.picks ?? [];

  const settled = picks
    .map((pk) => {
      const s = pk.match.predictions[0]?.settlement;
      return s ? { hit: s.outcomeHit, pnl: s.profitFlatUnits } : null;
    })
    .filter((x): x is { hit: boolean; pnl: number } => x != null);
  const wins = settled.filter((x) => x.hit).length;
  const losses = settled.length - wins;
  const totalPnl = settled.reduce((a, x) => a + x.pnl, 0);

  return (
    <div className="space-y-10 pb-8 max-w-3xl">
      <div>
        <p className="page-eyebrow">Immutable snapshots</p>
        <h1 className="page-title mt-2">Vault</h1>
        <p className="text-slate-400 mt-3 leading-relaxed">
          Each entry is a frozen snapshot — compare what the model saw at save time with the final result.
        </p>
      </div>

      {settled.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Settled picks</p>
            <p className="mt-1 font-display text-2xl font-black tabular-nums text-white">{settled.length}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">W / L</p>
            <p className="mt-1 font-display text-2xl font-black tabular-nums text-emerald-200">
              {wins} <span className="text-slate-600">/</span>{" "}
              <span className="text-rose-200/90">{losses}</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Flat units (1X2)</p>
            <p
              className={`mt-1 font-display text-2xl font-black tabular-nums ${
                totalPnl >= 0 ? "text-cyan-200" : "text-rose-200/90"
              }`}
            >
              {totalPnl >= 0 ? "+" : ""}
              {totalPnl.toFixed(2)}
            </p>
          </div>
        </div>
      ) : null}

      {picks.length === 0 ? (
        <EmptyState
          title="Vault is empty"
          description="Open any match breakdown and tap Save snapshot to capture odds context, confidence, and trust for later review."
          action={{ label: "Open deck", href: "/dashboard" }}
        />
      ) : (
        <div className="space-y-4">
          {picks.map((pk) => {
            const snap = pk.snapshot as { outcome?: string; confidence?: number };
            const pred = pk.match.predictions[0];
            const st = pred?.settlement;
            const isFt = pk.match.status === "FT";
            return (
              <div key={pk.id} className="card-premium p-5 flex flex-wrap justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">{pk.match.league?.name ?? "Fixture"}</p>
                  <Link
                    href={`/match/${pk.match.id}`}
                    className="text-lg font-bold text-white hover:text-sky-200 transition-colors font-display"
                  >
                    {pk.match.homeTeam.name} vs {pk.match.awayTeam.name}
                  </Link>
                  <p className="text-xs text-slate-500 mt-1">{new Date(pk.match.utcDate).toLocaleString()}</p>
                  {pk.label ? <p className="text-sm text-slate-400 mt-3">{pk.label}</p> : null}
                  <div className="mt-4 space-y-2 rounded-xl border border-white/[0.06] bg-black/20 p-3 text-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">At save</p>
                    <p className="text-slate-300">
                      Lean <span className="font-semibold text-amber-200">{snap.outcome ?? "—"}</span>
                      {snap.confidence != null ? (
                        <span className="text-slate-500"> · {(snap.confidence * 100).toFixed(0)}% conf</span>
                      ) : null}
                    </p>
                    {isFt && st ? (
                      <div className="pt-2 border-t border-white/[0.06] space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Result</p>
                        <p className="text-slate-200">
                          FT {st.homeScore}-{st.awayScore} · actual {st.actual1x2}
                        </p>
                        <p>
                          <span
                            className={`font-bold ${st.outcomeHit ? "text-emerald-300" : "text-rose-300/90"}`}
                          >
                            {st.outcomeHit ? "Pick hit" : "Pick miss"}
                          </span>
                          {st.exactScoreHit ? (
                            <span className="ml-2 text-xs text-amber-200/90">· exact score nailed</span>
                          ) : null}
                        </p>
                        <p className="tabular-nums text-cyan-200/90">
                          Flat P&amp;L {st.profitFlatUnits >= 0 ? "+" : ""}
                          {st.profitFlatUnits.toFixed(2)}u
                        </p>
                      </div>
                    ) : isFt && !st ? (
                      <p className="text-xs text-amber-200/80 pt-2">Full time — settlement syncing.</p>
                    ) : (
                      <p className="text-xs text-slate-500 pt-2">Pre-match — result will attach after FT.</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{pk.status}</span>
                  <button
                    type="button"
                    onClick={() => remove(pk.id)}
                    className="text-xs text-rose-300/90 hover:text-rose-200 font-semibold"
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

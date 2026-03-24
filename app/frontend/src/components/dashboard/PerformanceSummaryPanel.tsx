"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { MIN_HISTORY_FOR_PROOF, type PerformancePayload } from "@/lib/performanceTypes";

export function PerformanceSummaryPanel() {
  const q = useQuery({
    queryKey: ["insights-performance"],
    queryFn: () => apiFetch<PerformancePayload>("/api/insights/performance"),
    staleTime: 120_000,
    retry: 1,
  });

  if (q.isLoading) {
    return (
      <div
        className="h-24 rounded-2xl skeleton-shimmer border border-emerald-500/15"
        aria-busy="true"
        aria-label="Loading track record"
      />
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="rounded-2xl border border-rose-500/25 bg-rose-950/20 px-4 py-4 text-sm text-rose-100/95">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300/90">Track record</p>
        <p className="mt-2 text-slate-300">
          {(q.error as Error)?.message ?? "Could not load performance metrics."}
        </p>
        <button
          type="button"
          onClick={() => void q.refetch()}
          className="mt-3 text-sm font-semibold text-fuchsia-300 hover:text-fuchsia-200"
        >
          Retry
        </button>
        {" · "}
        <Link href="/insights" className="text-sm font-semibold text-fuchsia-300/90 hover:text-fuchsia-200">
          Open Signal center
        </Link>
      </div>
    );
  }

  const d = q.data;

  if (d.insufficientHistory || d.totalSettled < MIN_HISTORY_FOR_PROOF) {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-950/20 px-4 py-4 text-sm text-amber-100/90">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/90">Track record</p>
        <p className="mt-2 font-semibold text-amber-50">Not enough history yet</p>
        <p className="mt-2 text-slate-400">
          {d.totalSettled} settled rows in database. After full-time results and settlements accumulate, win rate and ROI
          show here — nothing is fabricated.
        </p>
        <Link href="/insights" className="mt-3 inline-block text-sm font-semibold text-fuchsia-300 hover:text-fuchsia-200">
          Signal center →
        </Link>
      </div>
    );
  }

  const a50 = d.actionableLast50;
  const a100 = d.actionableLast100;
  if (a50.n === 0 && a100.n === 0) {
    return (
      <div className="rounded-2xl border border-slate-500/25 bg-slate-950/30 px-4 py-4 text-sm text-slate-400">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Track record</p>
        <p className="mt-2 font-semibold text-slate-200">Not enough history yet</p>
        <p className="mt-2">
          {d.totalSettled} settled picks on file, but none are actionable (non–NO BET) in recent windows — see{" "}
          <Link href="/insights" className="font-semibold text-fuchsia-300 hover:text-fuchsia-200">
            Signal
          </Link>{" "}
          for full breakdowns.
        </p>
      </div>
    );
  }

  const primary = a50.n > 0 ? a50 : a100;
  const roi50 = a50.roiFlatUnits;
  const wr50 = a50.outcomeHitRate;
  const roi100 = a100.roiFlatUnits;
  const wr100 = a100.outcomeHitRate;

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-transparent px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-200/90">Proof · live history</p>
          <p className="font-display text-lg font-bold leading-snug text-white sm:text-xl">
            Last {primary.n} actionable picks:{" "}
            <span className="tabular-nums text-emerald-200">
              {primary.outcomeHitRate != null ? `${(primary.outcomeHitRate * 100).toFixed(0)}%` : "—"} win rate
            </span>
            {primary === a100 && a50.n === 0 ? (
              <span className="block text-sm font-normal text-slate-500">(using up to 100 — fewer than 50 actionable)</span>
            ) : null}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {a50.n > 0 ? (
              <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Last 50</p>
                <p className="mt-1 text-sm text-slate-200">
                  <span className="font-semibold text-white">
                    {wr50 != null ? `${(wr50 * 100).toFixed(0)}%` : "—"} win rate
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  ROI (flat 1u):{" "}
                  <span className="font-mono tabular-nums text-cyan-200/95">
                    {roi50 != null ? `${(roi50 * 100).toFixed(2)}%` : "—"} avg
                  </span>
                </p>
              </div>
            ) : null}
            {a100.n > 0 ? (
              <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Last 100</p>
                <p className="mt-1 text-sm text-slate-200">
                  <span className="font-semibold text-white">
                    {wr100 != null ? `${(wr100 * 100).toFixed(0)}%` : "—"} win rate
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  ROI (flat 1u):{" "}
                  <span className="font-mono tabular-nums text-cyan-200/95">
                    {roi100 != null ? `${(roi100 * 100).toFixed(2)}%` : "—"} avg
                  </span>
                </p>
              </div>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">
            Actionable = non–NO BET · {d.totalSettled} total settled
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2 lg:flex-col lg:items-end">
          {d.trendRolling15.length > 0 ? (
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] text-slate-400">
              Trend: rolling {d.trendRolling15[0]?.window ?? 15}-game 1X2 rate
            </span>
          ) : null}
          <Link
            href="/insights"
            className="inline-flex items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/25"
          >
            Full metrics
          </Link>
        </div>
      </div>
    </div>
  );
}

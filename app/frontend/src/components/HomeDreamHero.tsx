"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/constants";
import { TopPickCard, type TopPickMatch } from "@/components/TopPickCard";

type DashboardPayload = {
  matches: unknown[];
  topEdges: TopPickMatch[];
};

export function HomeDreamHero() {
  const token = useAuthStore((s) => s.token);
  const q = useQuery({
    queryKey: ["home-matches-preview", token],
    queryFn: () => apiFetch<DashboardPayload>("/api/matches", { token: token ?? undefined }),
    staleTime: 60_000,
    retry: 1,
  });

  const featured = q.data?.topEdges?.[0];
  const loading = q.isLoading;

  return (
    <section className="relative min-h-[min(92vh,56rem)] flex flex-col justify-center py-12 md:py-20 overflow-visible">
      <div className="pointer-events-none absolute -top-8 left-1/2 h-64 w-[120%] -translate-x-1/2 rounded-[100%] bg-gradient-to-b from-fuchsia-500/15 via-transparent to-transparent blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:gap-8 xl:gap-12">
          <div className="relative z-10 max-w-xl lg:mt-4 lg:w-[44%] lg:-rotate-1 motion-reduce:rotate-0">
            <p className="page-eyebrow pl-1">Football intelligence · alternate timeline</p>
            <h1 className="mt-5 font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl md:text-7xl">
              <span className="text-gradient">{PRODUCT_NAME}</span>
            </h1>
            <p className="mt-6 max-w-md font-display text-xl font-semibold leading-snug text-rose-100/90 md:text-2xl">
              {PRODUCT_TAGLINE}
            </p>
            <p className="mt-5 max-w-lg text-sm leading-relaxed text-slate-400/95 md:text-base">
              See today&apos;s fixtures with model edge, confidence, and explicit skip/watch flags. Sign in for watchlist,
              saved snapshots, and full match breakdowns — analytical tooling, not a tipping service.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/dashboard" className="btn-primary">
                Open the deck
              </Link>
              <Link href="/account" className="btn-secondary">
                Sign in
              </Link>
              <Link href="/pricing" className="btn-secondary">
                Plans
              </Link>
            </div>
            <p className="mt-10 max-w-sm text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500">
              Top edges first · Traps flagged · Track record on Signal
            </p>
          </div>

          <div className="relative z-0 min-h-[20rem] flex-1 lg:mt-0 lg:min-h-[28rem]">
            <div className="pointer-events-none absolute -right-4 top-0 h-40 w-40 rounded-full bg-gradient-to-br from-cyan-400/25 to-fuchsia-500/20 blur-2xl motion-safe:animate-float" />
            <div className="pointer-events-none absolute -left-8 bottom-8 h-48 w-48 rounded-full bg-gradient-to-tr from-orange-400/20 to-violet-500/25 blur-3xl motion-safe:animate-float [animation-delay:1.2s]" />

            <div className="relative lg:translate-x-2 lg:-translate-y-4 xl:translate-x-6">
              <div className="absolute -right-2 -top-6 z-20 hidden rotate-6 rounded-2xl border border-white/15 bg-gradient-to-br from-white/15 to-purple-950/40 px-4 py-3 text-right shadow-dream backdrop-blur-md sm:block">
                <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-fuchsia-200/90">Deck preview</p>
                <p className="mt-1 font-mono text-xs text-cyan-100/90">model · edges · trust</p>
              </div>

              <div className="relative z-10 rotate-1 motion-reduce:rotate-0 transition-transform duration-500 hover:rotate-0">
                {loading ? (
                  <div className="dream-panel min-h-[320px] p-10" aria-busy="true" aria-label="Loading deck preview">
                    <div className="h-8 w-40 skeleton-shimmer rounded-lg" />
                    <div className="mt-8 h-16 max-w-md skeleton-shimmer rounded-xl" />
                    <div className="mt-10 grid grid-cols-3 gap-3">
                      <div className="h-24 skeleton-shimmer rounded-2xl" />
                      <div className="h-24 skeleton-shimmer rounded-2xl" />
                      <div className="h-24 skeleton-shimmer rounded-2xl" />
                    </div>
                  </div>
                ) : q.isError ? (
                  <div className="dream-panel flex min-h-[320px] flex-col items-center justify-center p-10 text-center">
                    <p className="text-sm text-rose-200/95">{(q.error as Error).message}</p>
                    <button type="button" onClick={() => void q.refetch()} className="btn-primary mt-6">
                      Retry
                    </button>
                    <Link href="/dashboard" className="mt-4 text-sm font-semibold text-fuchsia-300 hover:text-fuchsia-200">
                      Open Deck
                    </Link>
                  </div>
                ) : featured ? (
                  <TopPickCard match={featured} />
                ) : (
                  <div className="dream-panel relative overflow-hidden p-8 md:p-10">
                    <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 via-transparent to-cyan-500/10" />
                    <div className="relative text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-fuchsia-300/90">Today&apos;s top edge</p>
                      <p className="mt-4 font-display text-2xl font-bold text-white/90">No fixture in window yet</p>
                      <p className="mx-auto mt-3 max-w-sm text-sm text-slate-400">
                        Run ingest from Admin or open the Deck — when the pipeline produces edges, the hero updates from
                        live data.
                      </p>
                      <Link
                        href="/dashboard"
                        className="btn-primary mt-8 inline-flex"
                      >
                        Open Deck
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <div className="absolute -bottom-4 left-4 z-20 max-w-[200px] -rotate-3 rounded-2xl border border-orange-400/25 bg-gradient-to-tl from-orange-500/15 to-purple-900/30 p-4 shadow-dream backdrop-blur-md motion-reduce:rotate-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-orange-200/90">Exact score</p>
                <p className="mt-2 font-mono text-lg text-white/90">
                  {featured?.prediction?.exactScore ?? "— : —"}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {featured?.prediction
                    ? `${Math.round(Math.min(1, Math.max(0, featured.prediction.confidence)) * 100)}% confidence`
                    : "Waiting for signal"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { MatchCard, type MatchCardProps } from "@/components/MatchCard";
import { FiltersPanel } from "@/components/FiltersPanel";
import { EmptyState } from "@/components/EmptyState";
import { DeckSummaryBar } from "@/components/dashboard/DeckSummaryBar";
import { PerformanceSummaryPanel } from "@/components/dashboard/PerformanceSummaryPanel";
import { DecisionHeroCard } from "@/components/dashboard/DecisionHeroCard";
import { formatRelativeShort } from "@/lib/formatRelative";
import type { DataContextPublic } from "@/lib/dataContext";
import { verdictFromRail } from "@/lib/decisionVerdict";

type MatchRow = {
  id: string;
  utcDate: string;
  oddsFetchedAt?: string | null;
  odds?: { homeOdds: number; drawOdds: number; awayOdds: number; bookmaker?: string | null } | null;
  homeTeam: { name: string };
  awayTeam: { name: string };
  league?: { name: string } | null;
  isWatched?: boolean;
  isNewFixture?: boolean;
  prediction?: MatchCardProps["prediction"];
  predictionEligibility?: MatchCardProps["predictionEligibility"];
  insufficientDataReason?: string | null;
  reliabilityFlags?: string[];
};

type DashboardPayload = {
  dataContext?: DataContextPublic;
  matches: MatchRow[];
  topEdges: MatchRow[];
  valuePicks: MatchRow[];
  traps: MatchRow[];
  avoidWeak: MatchRow[];
  recentlyUpdated: MatchRow[];
};

function toCardProps(m: MatchRow, rail?: MatchCardProps["rail"], size?: MatchCardProps["size"]): MatchCardProps {
  return {
    id: m.id,
    home: m.homeTeam.name,
    away: m.awayTeam.name,
    league: m.league?.name,
    utcDate: m.utcDate,
    oddsFetchedAt: m.oddsFetchedAt,
    odds: m.odds ?? undefined,
    isWatched: m.isWatched,
    isNewFixture: m.isNewFixture,
    rail,
    size,
    prediction: m.prediction ?? null,
    predictionEligibility: m.predictionEligibility ?? "OK",
    insufficientDataReason: m.insufficientDataReason,
    reliabilityFlags: m.reliabilityFlags,
    verdict: size === "compact" && rail ? verdictFromRail(rail) : undefined,
  };
}

function DecisionBlock({
  id,
  title,
  kicker,
  children,
  empty,
  emptyHint,
}: {
  id: string;
  title: string;
  kicker: string;
  children: React.ReactNode;
  empty: boolean;
  emptyHint: string;
}) {
  return (
    <section id={id} className="scroll-mt-28 space-y-5 lg:scroll-mt-32">
      <div className="border-b border-white/[0.08] pb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{kicker}</p>
        <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-white md:text-2xl">{title}</h2>
      </div>
      {empty ? (
        <p className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-500">
          {emptyHint}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-10" aria-hidden="true">
      <div className="h-24 rounded-2xl skeleton-shimmer border border-white/[0.08]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-72 rounded-2xl skeleton-shimmer border border-cyan-500/15" />
        ))}
      </div>
    </div>
  );
}

function edgeSnippet(m: MatchRow): string {
  const p = m.prediction;
  if (!p) return "—";
  if (p.edgeOnPickPct != null && Number.isFinite(p.edgeOnPickPct)) {
    const v = p.edgeOnPickPct;
    return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
  }
  return `${(p.valueScore * 100).toFixed(1)}%`;
}

export default function DashboardPage() {
  const token = useAuthStore((s) => s.token);
  const [leagueId, setLeagueId] = useState("");
  const q = useQuery({
    queryKey: ["matches", leagueId, token],
    queryFn: () => {
      const qs = leagueId ? `?leagueId=${encodeURIComponent(leagueId)}` : "";
      return apiFetch<DashboardPayload>(`/api/matches${qs}`, { token: token ?? undefined });
    },
    staleTime: 20_000,
    retry: 1,
  });

  if (q.isLoading) {
    return <LoadingSkeleton />;
  }
  if (q.isError) {
    const msg = (q.error as Error).message || "Check your connection and try again.";
    return (
      <EmptyState
        title="Couldn’t load decisions"
        description={msg}
        retry={() => void q.refetch()}
        secondary={{ label: "Go home", href: "/" }}
      />
    );
  }

  const data = q.data!;
  const updated =
    q.dataUpdatedAt != null ? formatRelativeShort(new Date(q.dataUpdatedAt).toISOString()) : null;

  const topEdges = data.topEdges ?? [];
  const valuePicks = data.valuePicks ?? [];
  const traps = data.traps ?? [];
  const avoidWeak = data.avoidWeak ?? [];
  const recentlyUpdated = data.recentlyUpdated ?? [];
  const allMatches = data.matches ?? [];
  const emptyScope = allMatches.length === 0;

  const dominant = topEdges.slice(0, 5);
  const skipTotal = traps.length + avoidWeak.length;

  const counts = {
    topEdges: dominant.length,
    valuePicks: valuePicks.length,
    traps: traps.length,
    avoidWeak: avoidWeak.length,
    recentlyUpdated: recentlyUpdated.length,
    skipTotal,
  };

  return (
    <div className="space-y-14 pb-12 md:space-y-16 md:pb-20">
      <DeckSummaryBar updatedLabel={updated} counts={counts} showSignIn={!token} />

      <FiltersPanel leagueId={leagueId} onLeagueChange={setLeagueId} />

      <PerformanceSummaryPanel />

      {emptyScope ? (
        <EmptyState
          title="Nothing in this league window"
          description="Ingest may still be running, or the league filter excludes all fixtures. Clear the filter or run the pipeline from Admin."
          action={{ label: "Track record", href: "/insights" }}
          secondary={{ label: "Plans", href: "/pricing" }}
        />
      ) : (
        <>
          <section id="decisions" className="scroll-mt-28 space-y-4 lg:scroll-mt-32">
            <div className="flex flex-col gap-2 border-b border-cyan-400/20 pb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300/90">Start here</p>
              <h2 className="font-display text-2xl font-bold text-white md:text-3xl">Best opportunities</h2>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
                <span className="font-semibold text-emerald-200/90">TAKE</span> = highest model edge vs market on this
                window. Open a card for full breakdown — edge is the headline number.
              </p>
            </div>
            {dominant.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-10 text-center text-sm text-slate-500">
                No fixture clears the edge and NO BET gates — the book may be tight. Check back after ingest or widen the
                league filter.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {dominant.map((m) => (
                  <DecisionHeroCard key={m.id} match={m} rail="edge" verdict="TAKE" />
                ))}
              </div>
            )}
          </section>

          <DecisionBlock
            id="more-edges"
            kicker="Still actionable · not in the top row"
            title="More edges"
            empty={valuePicks.length === 0}
            emptyHint="No additional high-edge fixtures beyond the top strip — or the same matches appear above."
          >
            {valuePicks.length === 0 ? null : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {valuePicks.map((m) => (
                  <MatchCard key={m.id} {...toCardProps(m, "edge", "compact")} />
                ))}
              </div>
            )}
          </DecisionBlock>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-rose-500/20 to-transparent" aria-hidden />

          <DecisionBlock
            id="skip"
            kicker="Do not treat as value"
            title="Skip these"
            empty={traps.length === 0 && avoidWeak.length === 0}
            emptyHint="No trap flags or weak / NO BET rows in this window."
          >
            {traps.length === 0 && avoidWeak.length === 0 ? null : (
              <div className="space-y-8">
                {traps.length > 0 ? (
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/80">Trap risk</p>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {traps.map((m) => (
                        <MatchCard key={m.id} {...toCardProps(m, "trap", "compact")} />
                      ))}
                    </div>
                  </div>
                ) : null}
                {avoidWeak.length > 0 ? (
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      NO BET / low confidence
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {avoidWeak.map((m) => (
                        <MatchCard key={m.id} {...toCardProps(m, "avoid", "compact")} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </DecisionBlock>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-sky-500/20 to-transparent" aria-hidden />

          <DecisionBlock
            id="watch"
            kicker="Monitor before staking"
            title="Watch"
            empty={recentlyUpdated.length === 0}
            emptyHint="Everything notable is already above, or the deck hasn’t re-run yet."
          >
            {recentlyUpdated.length === 0 ? null : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {recentlyUpdated.map((m) => (
                  <MatchCard key={m.id} {...toCardProps(m, "signal", "compact")} />
                ))}
              </div>
            )}
          </DecisionBlock>

          <details
            id="all-fixtures"
            className="group scroll-mt-28 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 sm:px-5 sm:py-4 lg:scroll-mt-32"
          >
            <summary className="cursor-pointer list-none font-display text-sm font-semibold text-slate-300 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                All fixtures in window
                <span className="rounded-full border border-white/[0.1] px-2 py-0.5 text-[11px] font-mono tabular-nums text-slate-500">
                  {allMatches.length}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-xs font-normal text-slate-500">
                  includes low-edge rows not shown above
                </span>
              </span>
            </summary>
            <ul className="mt-4 max-h-[min(28rem,50vh)] space-y-0 overflow-y-auto border-t border-white/[0.06] pt-3">
              {allMatches.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.04] py-2.5 text-sm last:border-0"
                >
                  <Link href={`/match/${m.id}`} className="min-w-0 font-medium text-slate-200 hover:text-fuchsia-200">
                    <span className="truncate">{m.homeTeam.name}</span>
                    <span className="text-slate-600"> v </span>
                    <span className="truncate">{m.awayTeam.name}</span>
                    <span className="ml-2 text-[11px] font-normal text-slate-500">
                      {m.league?.name ? `· ${m.league.name}` : ""}
                    </span>
                  </Link>
                  <span className="font-mono text-xs tabular-nums text-cyan-200/80">{edgeSnippet(m)}</span>
                </li>
              ))}
            </ul>
          </details>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-center text-xs text-slate-500">
            Need history or account tools?{" "}
            <Link href="/insights" className="font-semibold text-fuchsia-300 hover:text-fuchsia-200">
              Track record
            </Link>
            {" · "}
            <Link href="/watchlist" className="font-semibold text-fuchsia-300 hover:text-fuchsia-200">
              Watchlist
            </Link>
            {" · "}
            <Link href="/picks" className="font-semibold text-fuchsia-300 hover:text-fuchsia-200">
              Vault
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

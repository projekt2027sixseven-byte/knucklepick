"use client";

import Link from "next/link";
import { ConfidenceBar } from "./ConfidenceBar";
import { OddsStrip } from "./OddsStrip";
import { EdgeLabelBadge } from "./EdgeLabelBadge";
import type { MatchCardProps } from "./MatchCard";
import { formatRelativeShort } from "@/lib/formatRelative";

export type TopPickMatch = {
  id: string;
  utcDate: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  league?: { name: string } | null;
  odds?: { homeOdds: number; drawOdds: number; awayOdds: number; bookmaker?: string | null } | null;
  prediction?: MatchCardProps["prediction"];
  isNewFixture?: boolean;
};

export function TopPickCard({ match }: { match: TopPickMatch }) {
  const p = match.prediction;
  const confPct = p ? Math.round(Math.min(1, Math.max(0, p.confidence)) * 100) : 0;
  const edgePct =
    p?.edgeOnPickPct != null && Number.isFinite(p.edgeOnPickPct)
      ? p.edgeOnPickPct
      : p
        ? p.valueScore * 100
        : 0;

  return (
    <Link
      href={`/match/${match.id}`}
      className="group relative block overflow-hidden rounded-[2rem] border border-cyan-500/35 bg-gradient-to-br from-cyan-500/[0.12] via-purple-950/50 to-fuchsia-500/[0.08] shadow-glow-featured transition-all duration-500 hover:-translate-y-1 hover:border-cyan-400/45 hover:shadow-[0_0_60px_rgba(34,211,238,0.25)]"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.1)_0,rgba(255,255,255,0.1)_1px,transparent_1px,transparent_40px)]" />
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-cyan-500/35 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-gradient-to-tr from-fuchsia-400/25 to-cyan-500/15 blur-3xl" />

      <div className="relative px-6 py-8 md:px-10 md:py-10 md:text-center">
        <div className="flex flex-col gap-3 md:items-center md:gap-4">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/15 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.35)]">
              🔥 Top edge
            </span>
            {p ? <EdgeLabelBadge edgeLabel={p.edgeLabel} /> : null}
            {match.isNewFixture ? (
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/80">New listing</span>
            ) : null}
            {p?.mockContext ? (
              <span className="rounded-full border border-amber-400/35 bg-amber-500/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-amber-100/95">
                Synthetic odds
              </span>
            ) : null}
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {match.league?.name ?? "Fixture"}
          </p>
          {p?.engineRunAt ? (
            <p className="text-[11px] font-medium tabular-nums text-cyan-200/80">
              Model updated {formatRelativeShort(p.engineRunAt)}
            </p>
          ) : null}
          {p?.edgeOnPickPctDeltaPrev != null && Math.abs(p.edgeOnPickPctDeltaPrev) >= 0.35 ? (
            <p className="text-[11px] font-semibold text-amber-200/90">
              Edge {p.edgeOnPickPctDeltaPrev > 0 ? "increased" : "moved"}{" "}
              <span className="tabular-nums">{Math.abs(p.edgeOnPickPctDeltaPrev).toFixed(1)}pp</span> vs last run
            </p>
          ) : null}
          <h2 className="mx-auto max-w-3xl font-display text-2xl font-bold leading-tight tracking-tight text-white md:text-3xl lg:text-4xl">
            <span className="transition-colors group-hover:text-cyan-100">{match.homeTeam.name}</span>
            <span className="mx-2 font-normal text-cyan-300/50 md:mx-3">v</span>
            <span className="transition-colors group-hover:text-cyan-100">{match.awayTeam.name}</span>
          </h2>
          <p className="text-xs tabular-nums text-slate-500">{new Date(match.utcDate).toLocaleString()}</p>
          {match.odds ? (
            <div className="mt-4 flex justify-center">
              <OddsStrip
                variant="dense"
                home={match.odds.homeOdds}
                draw={match.odds.drawOdds}
                away={match.odds.awayOdds}
                bookmaker={match.odds.bookmaker}
              />
            </div>
          ) : null}
        </div>

        {p ? (
          <div className="mt-8 grid items-center gap-6 md:mt-10 md:grid-cols-3 md:gap-8">
            <div className="space-y-2 md:text-center md:col-span-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">Edge on pick</p>
              <p className="font-display text-5xl font-black tabular-nums leading-none text-transparent bg-gradient-to-br from-cyan-200 via-white to-fuchsia-200 bg-clip-text drop-shadow-[0_0_40px_rgba(34,211,238,0.45)] md:text-6xl">
                {edgePct >= 0 ? "+" : ""}
                {edgePct.toFixed(1)}
                <span className="ml-1 align-top text-2xl font-bold text-cyan-300/80 md:text-3xl">%</span>
              </p>
              <p className="text-[11px] text-slate-500">
                Model vs market on <span className="font-semibold text-amber-200/90">{p.outcomePrediction}</span>
              </p>
            </div>

            <div className="space-y-3 md:text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Exact score (lab)</p>
              <p className="font-display text-4xl font-black tabular-nums tracking-tight text-white drop-shadow-lg md:text-5xl">
                {p.exactScore}
              </p>
              <p className="text-xs text-slate-500">Supporting lattice read — not the primary signal.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-white/[0.1] bg-black/30 px-2 py-3 backdrop-blur-sm">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Confidence</p>
                  <p className="mt-1 font-display text-lg font-bold tabular-nums text-fuchsia-100">{confPct}%</p>
                </div>
                <div className="rounded-xl border border-white/[0.1] bg-black/30 px-2 py-3 backdrop-blur-sm">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Max 1X2 edge</p>
                  <p className="mt-1 font-display text-lg font-bold tabular-nums text-cyan-200">
                    {p.maxEdgeProb != null && Number.isFinite(p.maxEdgeProb)
                      ? `${(p.maxEdgeProb * 100).toFixed(1)}%`
                      : `${(p.valueScore * 100).toFixed(1)}%`}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.1] bg-black/30 px-2 py-3 backdrop-blur-sm">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Risk</p>
                  <p className="mt-1 text-sm font-bold uppercase leading-tight text-amber-200/95">{p.riskLevel}</p>
                </div>
              </div>
              <ConfidenceBar value={p.confidence} size="lg" />
            </div>
          </div>
        ) : (
          <p className="mt-8 text-center italic text-slate-400">Model output pending — drift back soon.</p>
        )}

        <p className="mt-8 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/90 opacity-0 transition-opacity group-hover:opacity-100">
          Open edge breakdown →
        </p>
      </div>
    </Link>
  );
}

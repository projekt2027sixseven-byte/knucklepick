"use client";

import Link from "next/link";
import { OddsStrip } from "@/components/OddsStrip";
import type { EdgeLabel } from "@/components/EdgeLabelBadge";
import { DecisionVerdictBadge } from "@/components/dashboard/DecisionVerdictBadge";
import {
  type DecisionVerdict,
  type DecisionRail,
  shortDecisionLabel,
  edgePercentDisplay,
  confidencePercentDisplay,
  verdictFromRail,
} from "@/lib/decisionVerdict";

type HeroPred = {
  outcomePrediction: string;
  confidence: number;
  valueScore: number;
  edgeOnPickPct?: number | null;
  noBet: boolean;
  trapMatch: boolean;
  edgeLabel?: EdgeLabel | null;
  mockContext?: boolean;
};

type MatchRow = {
  id: string;
  utcDate: string;
  odds?: { homeOdds: number; drawOdds: number; awayOdds: number; bookmaker?: string | null } | null;
  homeTeam: { name: string };
  awayTeam: { name: string };
  league?: { name: string } | null;
  prediction?: HeroPred | null;
};

/**
 * Large, edge-first decision tile for the top dashboard strip (3–5 fixtures).
 */
export function DecisionHeroCard({
  match,
  rail,
  verdict: verdictProp,
}: {
  match: MatchRow;
  rail: DecisionRail;
  verdict?: DecisionVerdict;
}) {
  const p = match.prediction;
  const verdict = verdictProp ?? verdictFromRail(rail);
  const label = shortDecisionLabel(p ?? null, rail);

  return (
    <Link
      href={`/match/${match.id}`}
      className="group flex min-h-[300px] flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[0_20px_50px_-24px_rgba(0,0,0,0.6)] transition-all duration-300 hover:border-cyan-400/35 hover:shadow-[0_24px_60px_-20px_rgba(34,211,238,0.18)]"
    >
      <DecisionVerdictBadge verdict={verdict} />

      <div className="flex flex-1 flex-col p-4 pt-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-500">{match.league?.name ?? "Fixture"}</p>
        <h3 className="mt-1.5 font-display text-lg font-bold leading-snug text-white group-hover:text-cyan-50">
          <span className="block truncate">{match.homeTeam.name}</span>
          <span className="my-0.5 block text-center text-[10px] font-normal text-fuchsia-400/50">v</span>
          <span className="block truncate">{match.awayTeam.name}</span>
        </h3>
        <p className="mt-2 text-[10px] tabular-nums text-slate-500">
          {new Date(match.utcDate).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>

        {p ? (
          <>
            <div className="mt-4 flex flex-1 flex-col justify-center border-t border-white/[0.08] pt-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Edge on pick</p>
              <p className="font-display text-4xl font-black tabular-nums leading-none tracking-tight text-cyan-200 sm:text-5xl">
                {edgePercentDisplay(p)}
              </p>
              <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Confidence</p>
              <p className="font-display text-2xl font-bold tabular-nums text-fuchsia-100/90">{confidencePercentDisplay(p)}%</p>
            </div>

            {match.odds ? (
              <div className="mt-4">
                <OddsStrip
                  variant="dense"
                  home={match.odds.homeOdds}
                  draw={match.odds.drawOdds}
                  away={match.odds.awayOdds}
                  bookmaker={match.odds.bookmaker}
                />
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-amber-100">
                {label}
              </span>
              {p.mockContext ? (
                <span className="rounded-full border border-slate-500/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Synthetic odds
                </span>
              ) : null}
              <span className="text-[10px] font-medium text-slate-400">
                Lean <span className="text-amber-200/90">{p.outcomePrediction}</span>
              </span>
            </div>
          </>
        ) : (
          <p className="mt-4 flex-1 text-sm text-slate-500">No model output</p>
        )}

        <p className="mt-4 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80 opacity-0 transition-opacity group-hover:opacity-100">
          Open breakdown →
        </p>
      </div>
    </Link>
  );
}

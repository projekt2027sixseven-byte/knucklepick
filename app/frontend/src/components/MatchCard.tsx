"use client";

import Link from "next/link";
import { ConfidenceBar } from "./ConfidenceBar";
import { RiskBadge } from "./RiskBadge";
import { WatchToggle } from "./WatchToggle";

export type MatchCardProps = {
  id: string;
  home: string;
  away: string;
  league?: string | null;
  utcDate: string;
  oddsFetchedAt?: string | null;
  isWatched?: boolean;
  prediction?: {
    outcomePrediction: string;
    confidence: number;
    exactScore: string;
    valueScore: number;
    riskLevel: string;
    noBet: boolean;
    trapMatch: boolean;
    trustIndex?: number;
    probHome?: number;
    probDraw?: number;
    probAway?: number;
  } | null;
};

function formatFreshness(iso?: string | null): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 120000) return "just now";
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  return `${Math.round(diff / 3600000)}h ago`;
}

export function MatchCard({
  id,
  home,
  away,
  league,
  utcDate,
  oddsFetchedAt,
  isWatched,
  prediction,
}: MatchCardProps) {
  const fresh = formatFreshness(oddsFetchedAt);

  return (
    <article className="card-premium p-6 transition-all group">
      <div className="flex justify-between gap-3">
        <Link href={`/match/${id}`} className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">{league ?? "Fixture"}</p>
          <h3 className="text-lg font-semibold mt-1 text-white group-hover:text-cyan-200 transition-colors truncate">
            {home} <span className="text-slate-500">vs</span> {away}
          </h3>
          <p className="text-xs text-slate-500 mt-2">{new Date(utcDate).toLocaleString()}</p>
          {fresh ? (
            <p className="text-[11px] text-emerald-300/80 mt-1">Odds pulse · {fresh}</p>
          ) : null}
        </Link>
        <div className="flex flex-col items-end gap-2">
          <WatchToggle matchId={id} initial={isWatched} />
          {prediction ? (
            <div className="text-right space-y-1 min-w-[150px]">
              <p className="text-sm text-amber-200 font-semibold">{prediction.outcomePrediction}</p>
              <p className="text-xs text-slate-400">Score {prediction.exactScore}</p>
              {prediction.trustIndex != null ? (
                <p className="text-[11px] text-cyan-200/90">Trust {Math.round(prediction.trustIndex)}</p>
              ) : null}
              <RiskBadge level={prediction.riskLevel} />
              {prediction.noBet ? (
                <span className="text-xs text-rose-300 block">NO BET</span>
              ) : null}
              {prediction.trapMatch ? (
                <span className="text-xs text-amber-300 block">TRAP</span>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Awaiting model</p>
          )}
        </div>
      </div>
      {prediction ? (
        <div className="mt-4">
          <ConfidenceBar value={prediction.confidence} />
          <p className="text-xs text-slate-500 mt-2">
            Value vs market: {(prediction.valueScore * 100).toFixed(1)}%
          </p>
          {prediction.probHome != null ? (
            <p className="text-[11px] text-slate-500 mt-1">
              p(1X2) {(prediction.probHome * 100).toFixed(0)} / {(prediction.probDraw! * 100).toFixed(0)} /{" "}
              {(prediction.probAway! * 100).toFixed(0)}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

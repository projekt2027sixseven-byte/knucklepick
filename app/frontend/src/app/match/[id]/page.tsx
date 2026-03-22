"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import { RiskBadge } from "@/components/RiskBadge";
import { ScorePredictionBox } from "@/components/ScorePredictionBox";
import { WatchToggle } from "@/components/WatchToggle";
import { SavePickButton } from "@/components/SavePickButton";

type Factor = { name: string; weight: number; contribution: number; detail?: string | null };
type Scenario = { id: string; label: string; score: string; probability: number; explanation: string };

type MatchDetail = {
  match: {
    id: string;
    utcDate: string;
    status: string;
    oddsFetchedAt?: string | null;
    homeTeam: { name: string };
    awayTeam: { name: string };
    league?: { name: string } | null;
    odds: { homeOdds: number; drawOdds: number; awayOdds: number; bookmaker?: string | null }[];
    stats?: {
      homeFormPts?: number | null;
      awayFormPts?: number | null;
      strengthGap?: number | null;
    } | null;
    similarityCases: { refMatchExt: string; similarity: number; result1x2?: string | null; score?: string | null }[];
  };
  prediction: Record<string, unknown> | null;
  usage?: {
    planSlug: string;
    dailyLimit: number;
    viewsToday: number;
    premiumLocked: boolean;
    watchlistLimit?: number;
    savedPickLimit?: number;
    digestEnabled?: boolean;
    apiAccess?: boolean;
  };
};

function ProbBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span>{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function SimilarityStatsPanel({ stats }: { stats: Record<string, unknown> }) {
  const n = Number(stats.sampleSize ?? 0);
  const h = Number(stats.winRateHome ?? 0);
  const d = Number(stats.winRateDraw ?? 0);
  const a = Number(stats.winRateAway ?? 0);
  const goals = Number(stats.avgTotalGoals ?? 0);
  const btts = Number(stats.bttsPct ?? 0);
  const o25 = Number(stats.over25Pct ?? 0);
  const o35 = Number(stats.over35Pct ?? 0);
  const common = stats.commonScores as { score: string; count: number }[] | undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Cohort n</p>
          <p className="text-lg font-semibold text-white mt-1">{n}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">1X2 in cohort</p>
          <p className="text-sm text-slate-200 mt-1">
            {h.toFixed(0)}% / {d.toFixed(0)}% / {a.toFixed(0)}%
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Avg goals</p>
          <p className="text-lg font-semibold text-amber-100 mt-1">{goals.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">BTTS · O2.5</p>
          <p className="text-sm text-slate-200 mt-1">
            {btts.toFixed(0)}% · {o25.toFixed(0)}%
            {o35 ? ` · O3.5 ${o35.toFixed(0)}%` : ""}
          </p>
        </div>
      </div>
      {common?.length ? (
        <div>
          <p className="text-xs text-slate-500 mb-2">Common scorelines in cohort</p>
          <div className="flex flex-wrap gap-2">
            {common.slice(0, 5).map((c) => (
              <span
                key={c.score}
                className="text-xs rounded-full border border-white/10 px-2.5 py-1 text-slate-300 bg-white/[0.03]"
              >
                {c.score} ×{c.count}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const token = useAuthStore((s) => s.token);
  const q = useQuery({
    queryKey: ["match", params.id, token],
    enabled: Boolean(params.id && token),
    queryFn: () => apiFetch<MatchDetail>(`/api/matches/${params.id}`, { token }),
  });

  if (!token) {
    return (
      <div className="glass-strong rounded-3xl p-10 text-center border border-white/10 max-w-md mx-auto">
        <p className="text-slate-300 leading-relaxed">
          Sign in to open full match intelligence — calibrated probabilities, similarity cohorts, and scenario lattice.
        </p>
        <Link href="/account" className="inline-block mt-6 btn-primary text-sm py-2.5 px-6">
          Sign in to continue
        </Link>
      </div>
    );
  }
  if (q.isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-1/3 rounded-lg bg-white/10" />
        <div className="h-48 rounded-2xl bg-white/5" />
      </div>
    );
  }
  if (q.isError) return <p className="text-rose-300">{(q.error as Error).message}</p>;
  const data = q.data!;
  const p = data.prediction;

  if (!p) {
    return <p className="text-slate-400">No prediction available yet. Run the pipeline from admin.</p>;
  }

  const locked = Boolean(p.premiumLocked ?? data.usage?.premiumLocked);
  const scenarios = (p.scenarios as Scenario[] | undefined) ?? [];
  const factors = (p.factors as Factor[] | undefined) ?? [];
  const simStats = p.similarityStats as Record<string, unknown> | undefined;
  const methodology = (p.methodology as string[] | undefined) ?? [];

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="page-eyebrow">{data.match.league?.name ?? "Fixture"}</p>
          <h1 className="text-3xl md:text-4xl font-semibold mt-2 text-white tracking-tight">
            {data.match.homeTeam.name}{" "}
            <span className="text-slate-600 font-normal text-2xl md:text-3xl px-1">vs</span> {data.match.awayTeam.name}
          </h1>
          <p className="text-slate-400 mt-2">{new Date(data.match.utcDate).toLocaleString()}</p>
          {data.match.oddsFetchedAt ? (
            <p className="text-xs text-emerald-300/80 mt-2">
              Odds pulse {new Date(data.match.oddsFetchedAt).toLocaleString()}
            </p>
          ) : null}
          {data.usage ? (
            <p className="text-xs text-slate-500 mt-2">
              Plan {data.usage.planSlug} · Premium views {data.usage.viewsToday}
              {data.usage.dailyLimit >= 0 ? ` / ${data.usage.dailyLimit}` : " / ∞"} · Watchlist cap{" "}
              {data.usage.watchlistLimit != null && data.usage.watchlistLimit >= 0
                ? data.usage.watchlistLimit
                : "∞"}{" "}
              · Vault cap{" "}
              {data.usage.savedPickLimit != null && data.usage.savedPickLimit >= 0
                ? data.usage.savedPickLimit
                : "∞"}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <WatchToggle matchId={data.match.id} />
          <SavePickButton matchId={data.match.id} />
        </div>
      </div>

      <div className="glass-strong rounded-2xl p-5 border border-white/10 flex flex-wrap gap-6 md:gap-10 items-center">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Model</p>
          <p className="text-sm font-semibold text-white mt-1">{String(p.modelVersion ?? "—")}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Trust index</p>
          <p className="text-sm font-semibold text-cyan-200 mt-1">{Number(p.trustIndex ?? 0).toFixed(0)} / 100</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Model confidence</p>
          <p className="text-sm font-semibold text-slate-100 mt-1">
            {(Number(p.modelConfidence ?? 0) * 100).toFixed(0)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Goals band</p>
          <p className="text-sm font-semibold text-amber-100 mt-1">
            {Number(p.goalsBandLow ?? 0).toFixed(2)} — {Number(p.goalsBandHigh ?? 0).toFixed(2)}
          </p>
        </div>
      </div>

      {locked ? (
        <div className="rounded-2xl border border-amber-500/35 bg-gradient-to-r from-amber-500/15 to-transparent p-5 text-sm">
          <p className="font-semibold text-amber-100">Premium breakdown limit reached for today</p>
          <p className="text-amber-100/80 mt-2 leading-relaxed">
            You can still browse the grid — open this fixture again after reset or upgrade for higher daily limits and
            digest automation.
          </p>
          <Link href="/pricing" className="inline-block mt-4 text-cyan-200 font-semibold hover:text-cyan-100 text-sm">
            Compare plans →
          </Link>
        </div>
      ) : null}

      <ScorePredictionBox
        exact={String(p.exactScore)}
        alt={p.altScore ? String(p.altScore) : null}
        xgHome={Number(p.expectedHomeGoals)}
        xgAway={Number(p.expectedAwayGoals)}
      />

      {!locked ? (
        <section className="glass rounded-2xl p-4 space-y-3 border border-white/5">
          <h2 className="font-semibold text-white">Calibrated 1X2 surface</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <ProbBar label="Home" value={Number(p.probHome)} />
            <ProbBar label="Draw" value={Number(p.probDraw)} />
            <ProbBar label="Away" value={Number(p.probAway)} />
          </div>
          <div className="grid md:grid-cols-3 gap-3 pt-2 border-t border-white/5">
            <ProbBar label="Cal. home" value={Number(p.calibratedHome ?? p.probHome)} />
            <ProbBar label="Cal. draw" value={Number(p.calibratedDraw ?? p.probDraw)} />
            <ProbBar label="Cal. away" value={Number(p.calibratedAway ?? p.probAway)} />
          </div>
          <p className="text-[11px] text-slate-500">
            Calibrated row shrinks extreme model mass back toward the market prior for honest tail risk.
          </p>
        </section>
      ) : null}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-4 space-y-3">
          <h2 className="font-semibold text-amber-200">1X2 outlook</h2>
          <p className="text-2xl font-bold text-white">{String(p.outcomePrediction)}</p>
          <ConfidenceBar value={Number(p.confidence)} />
          <div className="flex flex-wrap gap-2 items-center">
            <RiskBadge level={String(p.riskLevel)} />
            {p.noBet ? <span className="text-xs text-rose-300">NO BET</span> : null}
            {p.trapMatch ? <span className="text-xs text-amber-300">TRAP MATCH</span> : null}
          </div>
        </div>
        <div className="glass rounded-2xl p-4 space-y-2 text-sm text-slate-300">
          <h2 className="font-semibold text-cyan-200">Market alignment</h2>
          {!locked ? (
            <>
              <p>Value score: {(Number(p.valueScore) * 100).toFixed(2)}%</p>
              <p>Data quality: {Number(p.dataQualityScore).toFixed(0)} / 100</p>
              <p>Volatility: {Number(p.volatilityScore).toFixed(0)} / 100</p>
              <p>Similarity: {Number(p.similarityScore).toFixed(0)} / 100</p>
            </>
          ) : (
            <p className="text-slate-500">Upgrade or wait for reset to see full market analytics.</p>
          )}
        </div>
      </div>

      {!locked && methodology.length ? (
        <section className="glass rounded-2xl p-4 space-y-3 border border-white/5">
          <h2 className="font-semibold text-white">Methodology transparency</h2>
          <ul className="space-y-2 text-sm text-slate-300">
            {methodology.map((line, idx) => (
              <li key={`${idx}-${line.slice(0, 24)}`} className="flex gap-2">
                <span className="text-cyan-300">▹</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="glass rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-white">Reasoning</h2>
        <p className="text-slate-300 text-sm leading-relaxed">{String(p.reasoning)}</p>
      </section>

      {!locked ? (
        <>
          <section className="glass rounded-2xl p-4 space-y-3">
            <h2 className="font-semibold text-violet-200">Scenario lattice</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {scenarios.map((s) => (
                <div key={s.id} className="border border-white/10 rounded-xl p-3">
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <p className="text-lg font-semibold text-amber-200">{s.score}</p>
                  <p className="text-xs text-slate-400">
                    Joint mass ≈{" "}
                    {((s.probability <= 1 ? s.probability : s.probability / 100) * 100).toFixed(1)}%
                  </p>
                  <p className="text-sm text-slate-300 mt-2">{s.explanation}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="glass rounded-2xl p-5 space-y-4 border border-white/5">
            <div>
              <h2 className="font-semibold text-white text-lg">Historical similarity</h2>
              <p className="text-xs text-slate-500 mt-1">
                Structurally similar past fixtures (market shape & form), not same-team replay.
              </p>
            </div>
            {simStats ? <SimilarityStatsPanel stats={simStats} /> : null}
            <ul className="text-xs text-slate-500 space-y-2 border-t border-white/5 pt-4">
              {data.match.similarityCases.map((c) => (
                <li key={c.refMatchExt} className="flex flex-wrap gap-x-2 gap-y-1">
                  <span className="text-slate-400 font-mono">{c.refMatchExt}</span>
                  <span>·</span>
                  <span>match {c.similarity.toFixed(0)}</span>
                  <span>·</span>
                  <span>{c.result1x2 ?? "?"}</span>
                  <span>({c.score ?? "?"})</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="glass rounded-2xl p-4 space-y-3">
            <h2 className="font-semibold text-white">Factor breakdown</h2>
            <div className="space-y-2">
              {factors.map((f) => (
                <div key={f.name} className="flex justify-between text-sm border-b border-white/5 pb-2">
                  <div>
                    <p className="text-white">{f.name}</p>
                    {f.detail ? <p className="text-xs text-slate-500">{f.detail}</p> : null}
                  </div>
                  <div className="text-right text-slate-400">
                    <p>w {f.weight.toFixed(2)}</p>
                    <p>c {f.contribution.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <section className="glass rounded-2xl p-4">
        <h2 className="font-semibold mb-2 text-white">Latest odds</h2>
        <ul className="text-sm text-slate-400 space-y-1">
          {data.match.odds.map((o, i) => (
            <li key={i}>
              {o.bookmaker ?? "book"} · {o.homeOdds} / {o.drawOdds} / {o.awayOdds}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

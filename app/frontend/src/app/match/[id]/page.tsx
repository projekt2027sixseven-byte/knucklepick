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
import { EdgeLabelBadge, type EdgeLabel } from "@/components/EdgeLabelBadge";
import { messageForInsufficientReason, RELIABILITY_LABELS } from "@/lib/reliability";
import type { MatchTrackContext } from "@/lib/performanceTypes";
import { MatchTrackRecordPanel } from "@/components/MatchTrackRecordPanel";

type Factor = { name: string; weight: number; contribution: number; detail?: string | null };
type Scenario = { id: string; label: string; score: string; probability: number; explanation: string };

function parseEdgeLabel(pred: Record<string, unknown>): EdgeLabel | null {
  const e = pred.edgeLabel;
  return e === "HIGH" || e === "MEDIUM" || e === "NO_EDGE" ? e : null;
}

type MatchDetail = {
  match: {
    id: string;
    utcDate: string;
    status: string;
    oddsFetchedAt?: string | null;
    predictionEligibility?: string;
    insufficientDataReason?: string | null;
    reliabilityFlags?: string[];
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
  } | null;
  matchTrackContext?: MatchTrackContext | null;
};

function ProbBar({ label, value }: { label: string; value: number }) {
  const pct = value * 100;
  return (
    <div>
      <div className="flex justify-between text-[11px] text-slate-500 mb-1.5 font-medium">
        <span>{label}</span>
        <span className="text-sky-200 tabular-nums font-bold">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-white/[0.08] overflow-hidden ring-1 ring-knuckle-primary/20">
        <div
          className="h-full rounded-full bg-gradient-to-r from-knuckle-primary via-sky-400 to-knuckle-accent transition-all duration-500 shadow-[0_0_12px_rgba(59,130,246,0.2)]"
          style={{ width: `${pct}%` }}
        />
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
  const upset = stats.upsetFrequencyPct != null ? Number(stats.upsetFrequencyPct) : null;
  const strength = stats.similarityStrengthLabel as string | undefined;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400 leading-relaxed">
        In similar market setups, historical 1X2 outcomes in this cohort split about{" "}
        <span className="text-slate-200 font-medium">
          Home {h.toFixed(0)}% · Draw {d.toFixed(0)}% · Away {a.toFixed(0)}%
        </span>{" "}
        (past results — not a forecast for this fixture).
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        {strength ? (
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold px-2.5 py-1 rounded-full border border-knuckle-primary/35 text-sky-200 bg-knuckle-primary/10">
            Cohort · {strength}
          </span>
        ) : null}
        {upset != null && Number.isFinite(upset) ? (
          <span className="text-[10px] text-slate-500">
            Historical upset rate in cohort ≈ <span className="text-amber-200/90 tabular-nums">{upset.toFixed(0)}%</span>
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-knuckle-primary/15 bg-black/30 p-3 backdrop-blur-sm">
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
    enabled: Boolean(params.id),
    queryFn: () => apiFetch<MatchDetail>(`/api/matches/${params.id}`, { token: token ?? undefined }),
    staleTime: 60_000,
    retry: 1,
  });

  if (q.isLoading) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <div className="h-10 w-1/3 rounded-lg skeleton-shimmer border border-white/[0.06]" />
        <div className="h-48 rounded-2xl skeleton-shimmer border border-knuckle-primary/15" />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="h-32 rounded-xl skeleton-shimmer border border-white/[0.06]" />
          <div className="h-32 rounded-xl skeleton-shimmer border border-white/[0.06]" />
        </div>
      </div>
    );
  }
  if (q.isError) {
    const msg = (q.error as Error).message ?? "";
    const notFound = /not found|404|invalid match/i.test(msg);
    return (
      <div className="glass-strong mx-auto max-w-lg rounded-2xl border border-rose-500/25 p-8 text-center">
        <p className="font-display text-lg font-bold text-white">
          {notFound ? "Match not found" : "Couldn’t load match"}
        </p>
        <p className="mt-3 text-sm text-rose-200/95 leading-relaxed">{msg}</p>
        <p className="mt-2 text-xs text-slate-500">
          {notFound
            ? "It may have been removed, the link is wrong, or the API is unavailable."
            : "Check your connection or try again — your session may have expired."}
        </p>
        <button
          type="button"
          onClick={() => void q.refetch()}
          className="btn-primary mt-6 text-sm py-2.5 px-6"
        >
          Retry
        </button>
        <Link href="/dashboard" className="mt-4 block text-sm text-fuchsia-300 hover:text-fuchsia-200">
          Back to deck
        </Link>
      </div>
    );
  }
  const data = q.data!;
  const p = data.prediction;

  if (!p) {
    const insufficient = data.match.predictionEligibility === "INSUFFICIENT_DATA";
    return (
      <div className="space-y-4">
        <div className="glass-strong rounded-2xl p-6">
          <p className="page-eyebrow">{data.match.league?.name ?? "Fixture"}</p>
          <h1 className="font-display mt-2 text-2xl font-bold text-white md:text-3xl">
            {data.match.homeTeam.name} <span className="text-slate-600">vs</span> {data.match.awayTeam.name}
          </h1>
          <p className="mt-2 text-slate-400">{new Date(data.match.utcDate).toLocaleString()}</p>
        </div>
        {insufficient ? (
          <div className="rounded-2xl border border-amber-500/35 bg-amber-950/25 p-5 text-sm text-amber-100/90 leading-relaxed">
            <p className="font-bold text-amber-100 font-display">Insufficient data — no prediction</p>
            <p className="mt-2 text-slate-300">{messageForInsufficientReason(data.match.insufficientDataReason)}</p>
            <p className="mt-2 font-mono text-[11px] text-amber-200/70">
              code: {data.match.insufficientDataReason ?? "unknown"}
            </p>
            {data.match.reliabilityFlags && data.match.reliabilityFlags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.match.reliabilityFlags.map((f) => (
                  <span
                    key={f}
                    className="inline-flex rounded-full border border-rose-500/40 bg-rose-950/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-200"
                  >
                    {RELIABILITY_LABELS[f] ?? f}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-slate-400">
            No prediction for this fixture yet. Run the data pipeline from Admin or check back shortly.
          </p>
        )}
        <Link href="/dashboard" className="btn-secondary inline-flex text-sm">
          Return to deck
        </Link>
      </div>
    );
  }

  const anonymous = !data.usage;
  const locked = Boolean(p.premiumLocked ?? data.usage?.premiumLocked) || anonymous;
  const scenarios = (p.scenarios as Scenario[] | undefined) ?? [];
  const factors = (p.factors as Factor[] | undefined) ?? [];
  const simStats = p.similarityStats as Record<string, unknown> | undefined;
  const methodology = (p.methodology as string[] | undefined) ?? [];

  return (
    <div className="space-y-8 pb-8">
      <div className="glass-strong rounded-2xl p-5 md:p-6 border border-knuckle-primary/15 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-knuckle-primary/[0.07] to-transparent pointer-events-none" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="page-eyebrow">{data.match.league?.name ?? "Fixture"}</p>
          <h1 className="text-3xl md:text-4xl font-bold mt-2 text-white tracking-tight font-display">
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
      </div>

      <div className="glass-strong rounded-2xl border border-cyan-500/20 p-5">
        <div className="flex flex-wrap gap-6 md:gap-10 items-start">
        <div className="min-w-[140px]">
          <EdgeLabelBadge edgeLabel={parseEdgeLabel(p)} />
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-2">Edge on pick</p>
          <p className="text-2xl font-black font-display tabular-nums text-cyan-200 mt-1">
            {typeof p.edgeOnPickPct === "number"
              ? `${p.edgeOnPickPct >= 0 ? "+" : ""}${p.edgeOnPickPct.toFixed(1)}%`
              : `${((Number(p.valueScore) || 0) * 100).toFixed(1)}%`}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            vs de-vig market on <span className="text-amber-200/90 font-semibold">{String(p.outcomePrediction)}</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Model confidence</p>
          <p className="text-sm font-semibold text-slate-100 mt-1">
            {(Number(p.modelConfidence ?? 0) * 100).toFixed(0)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Trust index</p>
          <p className="text-sm font-bold text-sky-200 mt-1 font-display tabular-nums">
            {Number(p.trustIndex ?? 0).toFixed(0)} / 100
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Model</p>
          <p className="text-sm font-semibold text-white mt-1">{String(p.modelVersion ?? "—")}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Goals band</p>
          <p className="text-sm font-semibold text-amber-100 mt-1">
            {Number(p.goalsBandLow ?? 0).toFixed(2)} — {Number(p.goalsBandHigh ?? 0).toFixed(2)}
          </p>
        </div>
        </div>
        {typeof p.edgePctHome === "number" &&
        typeof p.edgePctDraw === "number" &&
        typeof p.edgePctAway === "number" ? (
          <div className="mt-5 border-t border-white/[0.08] pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">
              Edge % by outcome (model − de-vig market)
            </p>
            <div className="grid grid-cols-3 gap-3 text-center sm:gap-6">
              <div className="rounded-xl border border-white/[0.06] bg-black/20 px-2 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Home</p>
                <p className="mt-1 font-display text-lg font-bold tabular-nums text-cyan-200">
                  {p.edgePctHome >= 0 ? "+" : ""}
                  {p.edgePctHome.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-black/20 px-2 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Draw</p>
                <p className="mt-1 font-display text-lg font-bold tabular-nums text-cyan-200">
                  {p.edgePctDraw >= 0 ? "+" : ""}
                  {p.edgePctDraw.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-black/20 px-2 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Away</p>
                <p className="mt-1 font-display text-lg font-bold tabular-nums text-cyan-200">
                  {p.edgePctAway >= 0 ? "+" : ""}
                  {p.edgePctAway.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {anonymous ? (
        <div className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-500/10 to-transparent p-6 text-sm shadow-lift">
          <p className="font-bold text-fuchsia-100 font-display">Signed-out preview</p>
          <p className="mt-2 leading-relaxed text-slate-300">
            You&apos;re seeing a limited snapshot. Sign in to meter premium breakdowns against your plan, use watchlist &
            vault, and unlock cohorts, scenarios, and factor detail.
          </p>
          <Link href="/account" className="btn-primary mt-4 inline-block text-sm py-2.5 px-6">
            Sign in
          </Link>
        </div>
      ) : locked ? (
        <div className="rounded-2xl border border-amber-500/35 bg-gradient-to-r from-amber-500/15 to-transparent p-6 text-sm shadow-lift">
          <p className="font-bold text-amber-100 font-display">Premium breakdown limit reached for today</p>
          <p className="text-amber-100/85 mt-2 leading-relaxed">
            You can still browse the deck — open this fixture again after reset or upgrade for higher daily limits and
            digest automation.
          </p>
          <Link
            href="/pricing"
            className="inline-block mt-4 text-knuckle-primary font-bold hover:text-sky-200 text-sm transition-colors"
          >
            Compare plans →
          </Link>
        </div>
      ) : null}

      {(Boolean(p.mockContext) || Boolean(p.noBet) || Number(p.confidence ?? 0) < 0.46) && (
        <div className="rounded-2xl border border-slate-500/40 bg-slate-950/50 p-5 text-sm text-slate-200 leading-relaxed">
          <p className="font-bold text-slate-100 font-display">Signal honesty</p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-slate-400">
            {Boolean(p.mockContext) ? (
              <li>Demo / synthetic odds path — not included in public track-record stats.</li>
            ) : null}
            {Boolean(p.noBet) ? (
              <li>
                NO BET: separation, cohort quality, or model–market tension did not clear policy gates — treat as
                research only.
              </li>
            ) : null}
            {Number(p.confidence ?? 0) < 0.46 ? (
              <li>Low headline confidence — probabilities are diffuse; avoid treating this as a strong pick.</li>
            ) : null}
          </ul>
        </div>
      )}

      <MatchTrackRecordPanel ctx={data.matchTrackContext} volatilityScore={Number(p.volatilityScore ?? 0)} />

      <ScorePredictionBox
        exact={String(p.exactScore)}
        alt={p.altScore ? String(p.altScore) : null}
        xgHome={Number(p.expectedHomeGoals ?? 0)}
        xgAway={Number(p.expectedAwayGoals ?? 0)}
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
          <h2 className="font-bold text-sky-200 font-display">Market alignment</h2>
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
                <span className="text-knuckle-primary">▹</span>
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
            <h2 className="font-bold text-sky-200/95 font-display">Scenario lattice</h2>
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

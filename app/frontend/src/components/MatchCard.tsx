"use client";

import Link from "next/link";
import { ConfidenceBar } from "./ConfidenceBar";
import { OddsStrip } from "./OddsStrip";
import { RiskBadge } from "./RiskBadge";
import { EdgeLabelBadge, type EdgeLabel } from "./EdgeLabelBadge";
import { ValueBadge } from "./ValueBadge";
import { WatchToggle } from "./WatchToggle";
import { messageForInsufficientReason, RELIABILITY_LABELS } from "@/lib/reliability";
import { formatRelativeShort } from "@/lib/formatRelative";
import type { DecisionVerdict } from "@/lib/decisionVerdict";

function MatchSafetyBlock({
  reason,
  flags,
  compact,
}: {
  reason?: string | null;
  flags?: string[];
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-amber-500/35 bg-amber-950/25 ${
        compact ? "p-3 text-[11px]" : "p-4 text-xs"
      } leading-relaxed text-amber-100/90`}
    >
      <p className={`font-bold text-amber-50 font-display ${compact ? "text-[11px]" : "text-sm"}`}>
        Insufficient data — no prediction
      </p>
      <p className="mt-1 text-amber-100/85">{messageForInsufficientReason(reason)}</p>
      {flags && flags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {flags.map((f) => (
            <span
              key={f}
              className="inline-flex rounded-full border border-rose-500/40 bg-rose-950/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-rose-200"
            >
              {RELIABILITY_LABELS[f] ?? f.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type MatchCardProps = {
  id: string;
  home: string;
  away: string;
  league?: string | null;
  utcDate: string;
  oddsFetchedAt?: string | null;
  /** Latest 1X2 snapshot from the book — intelligence-first display. */
  odds?: { homeOdds: number; drawOdds: number; awayOdds: number; bookmaker?: string | null } | null;
  isWatched?: boolean;
  /** Visual rail: signal desk, value surface, trap radar, avoid / weak */
  rail?: "signal" | "edge" | "trap" | "avoid";
  /** default = balanced; highlight = larger metrics; compact = dense row for lists & rails */
  size?: "default" | "highlight" | "compact";
  prediction?: {
    outcomePrediction: string;
    confidence: number;
    exactScore: string;
    valueScore: number;
    /** Model − market on the displayed 1X2 pick (fraction); primary edge signal */
    edgeOnPick?: number | null;
    edgeOnPickPct?: number | null;
    edgeMaxPct?: number;
    riskLevel: string;
    noBet: boolean;
    trapMatch: boolean;
    trapBrief?: string | null;
    trustIndex?: number;
    probHome?: number;
    probDraw?: number;
    probAway?: number;
    /** Synthetic/demo odds path — excluded from public track record */
    mockContext?: boolean;
    /** ISO timestamp — last engine run for this fixture */
    updatedAt?: string;
    /** Edge tier from max(model − market) across 1X2 */
    edgeLabel?: EdgeLabel | null;
    /** Largest signed edge in probability mass (0–1) */
    maxEdgeProb?: number | null;
    strongSignal?: boolean;
    surfaceEligible?: boolean;
    engineRunAt?: string;
    confidenceDeltaPrev?: number | null;
    edgeOnPickPctDeltaPrev?: number | null;
    maxEdgeProbDeltaPrev?: number | null;
  } | null;
  /** When INSUFFICIENT_DATA, the API omits prediction — UI must not imply a model lean. */
  predictionEligibility?: "OK" | "INSUFFICIENT_DATA";
  insufficientDataReason?: string | null;
  reliabilityFlags?: string[];
  /** Match first seen on deck in last 48h — “new listing” cue. */
  isNewFixture?: boolean;
  /** Explicit TAKE / AVOID / WATCH — shown on compact decision rails. */
  verdict?: DecisionVerdict;
};

function formatFreshness(iso?: string | null): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 120000) return "just now";
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  return `${Math.round(diff / 3600000)}h ago`;
}

const verdictCompact: Record<DecisionVerdict, string> = {
  TAKE: "bg-emerald-500/15 text-emerald-100 border-emerald-400/35",
  AVOID: "bg-rose-950/50 text-rose-100 border-rose-400/35",
  WATCH: "bg-sky-500/12 text-sky-100 border-sky-400/35",
};

const railStyles: Record<NonNullable<MatchCardProps["rail"]>, string> = {
  signal:
    "border-l-[3px] border-l-fuchsia-400 shadow-[inset_3px_0_0_rgba(232,121,249,0.25)]",
  edge: "border-l-[3px] border-l-orange-400 shadow-[inset_3px_0_0_rgba(251,146,60,0.2)]",
  trap: "border-l-[3px] border-l-amber-300 shadow-[inset_3px_0_0_rgba(252,211,77,0.18)]",
  avoid: "border-l-[3px] border-l-slate-500/70 shadow-[inset_3px_0_0_rgba(100,116,139,0.22)]",
};

function confPct(pred: NonNullable<MatchCardProps["prediction"]>) {
  return Math.round(Math.min(1, Math.max(0, pred.confidence)) * 100);
}

function edgePickPct(pred: NonNullable<MatchCardProps["prediction"]>): number | null {
  if (pred.edgeOnPickPct != null && Number.isFinite(pred.edgeOnPickPct)) return pred.edgeOnPickPct;
  return null;
}

function EngagementChips({
  prediction,
  isNewFixture,
}: {
  prediction: NonNullable<MatchCardProps["prediction"]>;
  isNewFixture?: boolean;
}) {
  const edgeMove =
    prediction.edgeOnPickPctDeltaPrev != null && Math.abs(prediction.edgeOnPickPctDeltaPrev) >= 0.35;
  const confMove =
    prediction.confidenceDeltaPrev != null && Math.abs(prediction.confidenceDeltaPrev) >= 0.02;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {prediction.engineRunAt ? (
        <span className="text-[9px] font-medium tabular-nums text-slate-500">
          Model {formatRelativeShort(prediction.engineRunAt)}
        </span>
      ) : null}
      {isNewFixture ? (
        <span className="inline-flex rounded-full border border-sky-500/35 bg-sky-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-sky-200">
          New
        </span>
      ) : null}
      {edgeMove ? (
        <span className="inline-flex rounded-full border border-cyan-400/40 bg-cyan-500/12 px-2 py-0.5 text-[9px] font-bold tabular-nums text-cyan-100">
          Edge {prediction.edgeOnPickPctDeltaPrev! >= 0 ? "↑" : "↓"}
          {Math.abs(prediction.edgeOnPickPctDeltaPrev!).toFixed(1)}pp
        </span>
      ) : null}
      {confMove ? (
        <span className="inline-flex rounded-full border border-fuchsia-500/35 bg-fuchsia-500/10 px-2 py-0.5 text-[9px] font-bold tabular-nums text-fuchsia-100">
          Conf {prediction.confidenceDeltaPrev! >= 0 ? "+" : ""}
          {(prediction.confidenceDeltaPrev! * 100).toFixed(1)}pp
        </span>
      ) : null}
    </div>
  );
}

export function MatchCard({
  id,
  home,
  away,
  league,
  utcDate,
  oddsFetchedAt,
  odds,
  isWatched,
  rail,
  prediction,
  size = "default",
  predictionEligibility = "OK",
  insufficientDataReason,
  reliabilityFlags,
  isNewFixture,
  verdict,
}: MatchCardProps) {
  const fresh = formatFreshness(oddsFetchedAt);
  const baseRail = rail ? `${railStyles[rail]} pl-4 sm:pl-5` : "";
  const insufficient = predictionEligibility === "INSUFFICIENT_DATA";

  const watchHighlight = isWatched ? "ring-1 ring-inset ring-fuchsia-400/30 shadow-[0_0_24px_rgba(232,121,249,0.12)]" : "";

  if (size === "compact") {
    return (
      <article
        className={`card-premium relative min-w-[280px] max-w-[min(100%,420px)] shrink-0 snap-start overflow-hidden p-4 ${baseRail} ${watchHighlight}`}
      >
        {verdict ? (
          <div
            className={`mb-3 w-full rounded-lg border px-2.5 py-1.5 text-center text-[10px] font-black uppercase tracking-[0.28em] ${verdictCompact[verdict]}`}
          >
            {verdict}
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <Link href={`/match/${id}`} className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">{league ?? "Fixture"}</p>
            <h3 className="mt-1 font-display text-base font-bold leading-tight text-white">
              {home} <span className="font-normal text-fuchsia-400/45">v</span> {away}
            </h3>
            <p className="mt-1 text-[10px] tabular-nums text-slate-500">{new Date(utcDate).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</p>
            {prediction && !insufficient ? (
              <div className="mt-2">
                <EngagementChips prediction={prediction} isNewFixture={isNewFixture} />
              </div>
            ) : null}
            {odds ? (
              <OddsStrip
                className="mt-2"
                variant="compact"
                home={odds.homeOdds}
                draw={odds.drawOdds}
                away={odds.awayOdds}
                bookmaker={odds.bookmaker}
              />
            ) : null}
          </Link>
          <WatchToggle matchId={id} initial={isWatched} />
        </div>
        {insufficient ? (
          <MatchSafetyBlock reason={insufficientDataReason} flags={reliabilityFlags} compact />
        ) : prediction ? (
          <>
            <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-white/[0.06] pt-4">
              <div className="min-w-[7rem] flex-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Edge</p>
                <p className="font-display text-3xl font-black tabular-nums leading-none text-cyan-200 sm:text-4xl">
                  {edgePickPct(prediction) != null
                    ? `${edgePickPct(prediction)! >= 0 ? "+" : ""}${edgePickPct(prediction)!.toFixed(1)}%`
                    : `${(prediction.valueScore * 100).toFixed(1)}%`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Conf</p>
                <p className="font-display text-lg font-bold tabular-nums text-fuchsia-100/90 sm:text-xl">{confPct(prediction)}%</p>
              </div>
              <div className="w-full min-w-0 sm:w-auto sm:flex-1 sm:text-right">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Lean</p>
                <p className="line-clamp-2 text-xs font-semibold leading-tight text-amber-200/95">{prediction.outcomePrediction}</p>
              </div>
            </div>
            <div className="mt-3">
              <ConfidenceBar value={prediction.confidence} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <EdgeLabelBadge edgeLabel={prediction.edgeLabel} />
              <RiskBadge level={prediction.riskLevel} />
              <ValueBadge valueScore={prediction.valueScore} edgeOnPickPct={prediction.edgeOnPickPct} />
              {prediction.noBet ? (
                <span className="inline-flex rounded-full border border-rose-500/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-300">
                  No bet
                </span>
              ) : null}
              {prediction.mockContext ? (
                <span className="inline-flex rounded-full border border-slate-500/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Demo odds
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <p className="mt-3 text-xs italic text-slate-500">Awaiting model</p>
        )}
      </article>
    );
  }

  const isHighlight = size === "highlight";
  const scoreClass = isHighlight
    ? "font-display text-5xl font-black tabular-nums tracking-tight text-white md:text-6xl"
    : "font-display text-4xl font-black tabular-nums tracking-tight text-white md:text-5xl";
  const edgeClass = isHighlight
    ? "font-display text-5xl font-black tabular-nums leading-none text-cyan-200 md:text-6xl"
    : "font-display text-4xl font-black tabular-nums leading-none text-cyan-200 md:text-5xl";
  const confClass = isHighlight
    ? "font-display text-3xl font-black tabular-nums leading-none text-fuchsia-100/90 md:text-4xl"
    : "font-display text-2xl font-black tabular-nums leading-none text-fuchsia-100/90 md:text-3xl";
  const pad = isHighlight ? "p-6 md:p-8" : "p-5 md:p-6";

  return (
    <article
      className={`card-premium group relative overflow-hidden transition-all duration-400 ${baseRail} ${pad} ${watchHighlight}`}
    >
      <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-bl-full bg-gradient-to-bl from-fuchsia-500/15 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className={`relative flex flex-col gap-5 ${isHighlight ? "lg:flex-row lg:items-start lg:justify-between lg:gap-8" : "sm:flex-row sm:justify-between"}`}>
        <Link href={`/match/${id}`} className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{league ?? "Fixture"}</p>
          <h3
            className={`mt-2 font-display font-bold leading-snug tracking-tight text-white transition-colors duration-300 group-hover:text-fuchsia-100 ${
              isHighlight ? "text-2xl md:text-3xl" : "text-xl"
            }`}
          >
            {home} <span className={`font-normal text-fuchsia-400/40 ${isHighlight ? "text-2xl" : "text-lg"}`}>v</span> {away}
          </h3>
          <p className="mt-2 text-xs tabular-nums text-slate-500">{new Date(utcDate).toLocaleString()}</p>
          {prediction && !insufficient ? (
            <div className="mt-2">
              <EngagementChips prediction={prediction} isNewFixture={isNewFixture} />
            </div>
          ) : null}
          {fresh ? (
            <p className="mt-2 text-[11px] font-semibold text-cyan-300/90">
              Odds pulse · <span className="tabular-nums">{fresh}</span>
            </p>
          ) : null}
        </Link>

        <div className="flex shrink-0 flex-row items-start justify-between gap-4 sm:flex-col sm:items-end">
          <WatchToggle matchId={id} initial={isWatched} />
          {insufficient ? (
            <div className="w-full max-w-md sm:text-left">
              <MatchSafetyBlock reason={insufficientDataReason} flags={reliabilityFlags} />
            </div>
          ) : prediction ? (
            <div className="w-full space-y-4 text-left sm:w-auto sm:min-w-[220px] sm:text-right">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Edge on pick</p>
                <p className={`${edgeClass} mt-1`}>
                  {edgePickPct(prediction) != null
                    ? `${edgePickPct(prediction)! >= 0 ? "+" : ""}${edgePickPct(prediction)!.toFixed(1)}`
                    : (prediction.valueScore * 100).toFixed(1)}
                  <span className="align-top text-xl font-bold text-cyan-300/80 md:text-2xl">%</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Confidence</p>
                  <p className={`${confClass} mt-1`}>
                    {confPct(prediction)}
                    <span className="align-top text-lg font-bold text-fuchsia-300/70 md:text-xl">%</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Lean</p>
                  <p className={`font-bold text-amber-200/95 ${isHighlight ? "font-display text-base" : "font-display text-sm"}`}>
                    {prediction.outcomePrediction}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Exact score (supporting)</p>
                <p className={`${scoreClass} mt-1 drop-shadow-md opacity-95`}>{prediction.exactScore}</p>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <EdgeLabelBadge edgeLabel={prediction.edgeLabel} />
                <RiskBadge level={prediction.riskLevel} />
                <ValueBadge valueScore={prediction.valueScore} edgeOnPickPct={prediction.edgeOnPickPct} />
              </div>
              {prediction.noBet ? (
                <span className="inline-flex rounded-full border border-rose-500/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                  No bet
                </span>
              ) : null}
              {prediction.trapMatch ? (
                <span className="inline-flex rounded-full border border-amber-500/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  Trap
                </span>
              ) : null}
              {prediction.mockContext ? (
                <span className="inline-flex rounded-full border border-slate-500/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Demo odds
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-sm italic text-slate-500">Awaiting model</p>
          )}
        </div>
      </div>

      {rail === "trap" && prediction?.trapMatch && prediction.trapBrief ? (
        <p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-950/20 p-3 text-[11px] leading-relaxed text-amber-100/85">
          {prediction.trapBrief}
        </p>
      ) : null}

      {prediction ? (
        <div className="mt-5 space-y-4 border-t border-white/[0.06] pt-5">
          <ConfidenceBar value={prediction.confidence} size={isHighlight ? "lg" : "md"} />
          {prediction.trustIndex != null ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="font-medium text-slate-500">
                Trust index{" "}
                <span className="font-bold tabular-nums text-fuchsia-200">{Math.round(prediction.trustIndex)}</span>
              </span>
              {prediction.probHome != null ? (
                <p className="text-[10px] font-medium tabular-nums text-slate-500">
                  1X2 {(prediction.probHome * 100).toFixed(0)} · {(prediction.probDraw! * 100).toFixed(0)} ·{" "}
                  {(prediction.probAway! * 100).toFixed(0)}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

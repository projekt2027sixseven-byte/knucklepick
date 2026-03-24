"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import {
  NAIVE_BASELINE_1X2,
  TRACK_RECORD_MIN_N,
  type PerformancePayload,
  type PerformanceSlice,
} from "@/lib/performanceTypes";

type PlatformInsight = {
  product: string;
  tagline: string;
  modelVersion: string;
  lastModelRun: string | null;
  fixturesIndexed48h: number;
  pillars: string[];
  disclaimers: string[];
};

function pct(x: number | null | undefined): string {
  if (x == null || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(1)}%`;
}

function num(x: number | null | undefined, d = 3): string {
  if (x == null || Number.isNaN(x)) return "—";
  return x.toFixed(d);
}

function interpretVsBaseline(
  s: PerformanceSlice,
  baseline: number
): { tier: "good" | "average" | "weak"; copy: string } | null {
  if (s.n < TRACK_RECORD_MIN_N || s.outcomeHitRate == null) return null;
  const hr = s.outcomeHitRate;
  const gap = hr - baseline;
  if (gap >= 0.06) {
    return {
      tier: "good",
      copy: "Ahead of a naive 1/3 baseline on this window — ex-post only; not predictive of the next slate.",
    };
  }
  if (gap >= -0.04) {
    return {
      tier: "average",
      copy: "Roughly in line with baseline variance — sample still descriptive, not a promise.",
    };
  }
  return {
    tier: "weak",
    copy: "Below baseline on this window — treat as a humbling check, not a verdict on the whole system.",
  };
}

function tierStyles(tier: "good" | "average" | "weak"): { border: string; bg: string; accent: string; label: string } {
  if (tier === "good") {
    return {
      border: "border-emerald-500/35",
      bg: "from-emerald-500/[0.12] to-transparent",
      accent: "text-emerald-200",
      label: "Good",
    };
  }
  if (tier === "average") {
    return {
      border: "border-sky-500/30",
      bg: "from-sky-500/[0.08] to-transparent",
      accent: "text-sky-200",
      label: "Average",
    };
  }
  return {
    border: "border-amber-500/35",
    bg: "from-amber-500/[0.1] to-transparent",
    accent: "text-amber-200",
    label: "Weak",
  };
}

function SliceTable({ title, s }: { title: string; s: PerformanceSlice }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">{title}</p>
      {s.n === 0 ? (
        <p className="text-sm text-slate-500">No settled fixtures in this window yet.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">Sample n</dt>
          <dd className="text-slate-200 font-mono tabular-nums text-right">{s.n}</dd>
          <dt className="text-slate-500">1X2 hit rate</dt>
          <dd className="text-sky-200 font-mono tabular-nums text-right">{pct(s.outcomeHitRate)}</dd>
          <dt className="text-slate-500">Draw pick rate</dt>
          <dd className="text-slate-300 font-mono tabular-nums text-right">{pct(s.drawPickRate)}</dd>
          <dt className="text-slate-500">Draw accuracy (when we pick DRAW)</dt>
          <dd className="text-slate-300 font-mono tabular-nums text-right">{pct(s.drawAccuracy)}</dd>
          <dt className="text-slate-500">Exact score hit</dt>
          <dd className="text-amber-200/90 font-mono tabular-nums text-right">{pct(s.exactScoreHitRate)}</dd>
          <dt className="text-slate-500">O/U 2.5 (when model not UNCERTAIN)</dt>
          <dd className="text-slate-300 font-mono tabular-nums text-right">{pct(s.ouHitRate)}</dd>
          <dt className="text-slate-500">BTTS (when model not UNCERTAIN)</dt>
          <dd className="text-slate-300 font-mono tabular-nums text-right">{pct(s.bttsHitRate)}</dd>
          <dt className="text-slate-500">Mean Brier (1X2)</dt>
          <dd className="text-slate-300 font-mono tabular-nums text-right">{num(s.meanBrier)}</dd>
          <dt className="text-slate-500">ROI (flat 1u, 1X2)</dt>
          <dd className="text-emerald-200/90 font-mono tabular-nums text-right">{num(s.roiFlatUnits, 4)}</dd>
        </dl>
      )}
    </div>
  );
}

export default function InsightsPage() {
  const q = useQuery({
    queryKey: ["insights-platform"],
    queryFn: () => apiFetch<PlatformInsight>("/api/insights/platform"),
    retry: 1,
  });
  const perf = useQuery({
    queryKey: ["insights-performance"],
    queryFn: () => apiFetch<PerformancePayload>("/api/insights/performance"),
    retry: 1,
  });

  if (q.isLoading) {
    return (
      <div className="space-y-6 max-w-4xl" role="status" aria-busy="true" aria-label="Loading insights">
        <div className="h-40 rounded-[1.75rem] skeleton-shimmer border border-white/[0.06]" />
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="h-32 rounded-2xl skeleton-shimmer border border-white/[0.06]" />
          <div className="h-32 rounded-2xl skeleton-shimmer border border-white/[0.06]" />
        </div>
        <div className="h-36 rounded-2xl skeleton-shimmer border border-white/[0.06]" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="glass-strong max-w-xl rounded-[1.75rem] p-8 border border-rose-500/25 bg-rose-950/20 text-rose-100 text-sm leading-relaxed">
        <p className="text-[10px] uppercase tracking-[0.25em] text-rose-300/90 font-bold font-display mb-2">Signal center</p>
        <p>{(q.error as Error).message}</p>
        <button
          type="button"
          onClick={() => void q.refetch()}
          className="btn-primary mt-5 text-sm"
        >
          Try again
        </button>
      </div>
    );
  }
  const d = q.data!;

  return (
    <div className="space-y-10 pb-8 max-w-4xl">
      <div className="glass-strong rounded-[1.75rem] p-8 md:p-10 border border-white/[0.08] space-y-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.06)_0,rgba(255,255,255,0.06)_1px,transparent_1px,transparent_44px)]" />
        <div className="relative">
          <p className="page-eyebrow">Signal center</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight font-display">{d.product}</h1>
          <p className="text-slate-400 text-lg leading-relaxed mt-3">{d.tagline}</p>
          <div className="flex flex-wrap gap-3 text-sm text-slate-300 mt-6">
            <span className="rounded-full border border-white/[0.1] px-3 py-1.5 bg-white/[0.03] font-medium">
              Model {d.modelVersion}
            </span>
            <span className="rounded-full border border-white/[0.1] px-3 py-1.5 bg-white/[0.03] font-medium">
              Last run {d.lastModelRun ? new Date(d.lastModelRun).toLocaleString() : "—"}
            </span>
            <span className="rounded-full border border-white/[0.1] px-3 py-1.5 bg-white/[0.03] font-medium">
              Fixtures (48h) {d.fixturesIndexed48h}
            </span>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white font-display">Verified track record</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Ex-post metrics from settled matches only. We never fabricate win rates — empty cells mean not enough history
          yet.
        </p>
        {perf.isLoading ? (
          <div className="h-48 rounded-2xl skeleton-shimmer border border-white/[0.06]" />
        ) : perf.isError ? (
          <EmptyState
            title="Couldn’t load performance metrics"
            description={(perf.error as Error).message}
            retry={() => void perf.refetch()}
          />
        ) : perf.data!.insufficientHistory ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/25 p-6 text-center">
            <p className="font-display text-lg font-bold text-amber-100">Not enough history yet</p>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              We need at least{" "}
              <span className="font-mono text-slate-300">10</span> settled non-mock predictions before showing headline
              win rates and ROI. Currently:{" "}
              <span className="font-mono text-slate-200">{perf.data!.totalSettled}</span>. Settlements run after full-time
              scores are stored.
            </p>
            <p className="mt-4 text-xs text-slate-500">{perf.data!.note}</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500 leading-relaxed">{perf.data!.note}</p>
            <p className="text-sm text-slate-400">
              Total settled (non-mock) predictions in database:{" "}
              <span className="text-slate-200 font-mono">{perf.data!.totalSettled}</span>
            </p>

            {(() => {
              const verdict = interpretVsBaseline(perf.data!.actionableLast50, NAIVE_BASELINE_1X2);
              if (!verdict) return null;
              const st = tierStyles(verdict.tier);
              const hr = perf.data!.actionableLast50.outcomeHitRate;
              return (
                <div
                  className={`rounded-2xl border bg-gradient-to-br ${st.border} ${st.bg} p-6 md:p-7 space-y-3`}
                >
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-bold">
                        Readability · last 50 actionable
                      </p>
                      <p className="mt-2 font-display text-2xl font-bold text-white">
                        <span className={st.accent}>{st.label}</span>
                        <span className="text-slate-500 text-lg font-semibold"> vs baseline</span>
                      </p>
                    </div>
                    <div className="text-right text-sm text-slate-400">
                      <p>
                        Realized 1X2:{" "}
                        <span className="font-mono text-slate-100 tabular-nums">
                          {hr != null ? `${(hr * 100).toFixed(1)}%` : "—"}
                        </span>
                      </p>
                      <p>
                        Naive baseline:{" "}
                        <span className="font-mono tabular-nums text-slate-300">
                          {(NAIVE_BASELINE_1X2 * 100).toFixed(1)}%
                        </span>
                      </p>
                    </div>
                  </div>
                  {hr != null ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>Naive 1X2 baseline</span>
                          <span className="font-mono tabular-nums">{(NAIVE_BASELINE_1X2 * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-slate-500/55"
                            style={{ width: `${NAIVE_BASELINE_1X2 * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>Last 50 actionable · realized hit rate</span>
                          <span className="font-mono tabular-nums text-emerald-200/90">
                            {(hr * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-400/75"
                            style={{ width: `${Math.min(100, hr * 100)}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{verdict.copy}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 leading-relaxed">{verdict.copy}</p>
                  )}
                </div>
              );
            })()}

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-6 md:p-8 space-y-2">
              <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-200/90 font-bold">Headline</p>
              <p className="font-display text-2xl md:text-3xl font-bold text-white">
                Last {perf.data!.actionableLast50.n} actionable picks (up to 50):{" "}
                <span className="text-emerald-200 tabular-nums">
                  {perf.data!.actionableLast50.outcomeHitRate != null
                    ? `${(perf.data!.actionableLast50.outcomeHitRate * 100).toFixed(1)}%`
                    : "—"}{" "}
                  win rate
                </span>
              </p>
              <p className="text-lg text-slate-300">
                ROI (flat 1u @ snapshot 1X2):{" "}
                <span className="font-mono tabular-nums text-cyan-200">
                  {perf.data!.actionableLast50.roiFlatUnits != null
                    ? `${(perf.data!.actionableLast50.roiFlatUnits * 100).toFixed(2)}%`
                    : "—"}{" "}
                  avg per pick
                </span>
              </p>
              <p className="text-xs text-slate-500 pt-2">
                Actionable = excluding explicit NO BET. Same windows as the live pipeline trust nudges.
              </p>
            </div>

            <div className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/[0.06] p-5 space-y-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-fuchsia-200/90 font-bold">
                Platform trust (data-driven)
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Derived from the last {perf.data!.trackRecord.sampleSize} actionable settled picks vs a naive 1/3 1X2
                baseline. Same signal nudges headline confidence and trust in live predictions when history is sufficient
                (≥8 picks). Not a guarantee of future results.
              </p>
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Trust score</p>
                  <p className="font-display text-4xl font-black tabular-nums text-fuchsia-100">
                    {perf.data!.platformTrustScore != null ? perf.data!.platformTrustScore.toFixed(0) : "—"}
                    <span className="text-lg font-bold text-slate-500 ml-1">/100</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Realized 1X2 hit rate</p>
                  <p className="text-xl font-bold tabular-nums text-slate-100">
                    {perf.data!.trackRecord.hitRate != null
                      ? `${(perf.data!.trackRecord.hitRate * 100).toFixed(1)}%`
                      : "—"}{" "}
                    <span className="text-sm font-normal text-slate-500">
                      (n={perf.data!.trackRecord.sampleSize}, baseline {(perf.data!.trackRecord.naiveBaseline * 100).toFixed(1)}%)
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Live pipeline nudges</p>
                  <p className="text-sm font-mono text-slate-300">
                    Δconf {(perf.data!.trackRecord.confidenceDelta * 100).toFixed(2)}pp · Δtrust{" "}
                    {perf.data!.trackRecord.trustDelta >= 0 ? "+" : ""}
                    {perf.data!.trackRecord.trustDelta.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>

            {perf.data!.trendRolling15.length > 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
                  Trend · rolling {perf.data!.trendRolling15[0]?.window ?? 15}-game 1X2 hit rate
                </p>
                <p className="text-xs text-slate-500">
                  Each bar is the hit rate over the previous {perf.data!.trendRolling15[0]?.window ?? 15} actionable settled
                  picks ending at that fixture (chronological).
                </p>
                <div className="flex items-end gap-0.5 h-24 overflow-x-auto pb-1 border-b border-white/[0.06]">
                  {perf.data!.trendRolling15.map((pt) => (
                    <div
                      key={pt.settledAt}
                      className="flex-1 min-w-[4px] max-w-[14px] rounded-t bg-gradient-to-t from-cyan-600/40 to-cyan-300/90"
                      style={{ height: `${Math.max(4, Math.round(pt.rollingHitRate * 92))}px` }}
                      title={`${new Date(pt.settledAt).toLocaleDateString()}: ${(pt.rollingHitRate * 100).toFixed(1)}%`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-slate-600">
                  Oldest ← {perf.data!.trendRolling15.length} samples → newest
                </p>
              </div>
            ) : null}

            {perf.data!.trendRecentVsPrior ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <SliceTable title="Most recent 20 actionable (chronological)" s={perf.data!.trendRecentVsPrior.recent20} />
                <SliceTable title="Prior 20 actionable" s={perf.data!.trendRecentVsPrior.prior20} />
              </div>
            ) : null}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <SliceTable title="Last 10 · actionable" s={perf.data!.actionableLast10} />
              <SliceTable title="Last 50 · actionable" s={perf.data!.actionableLast50} />
              <SliceTable title="Last 100 · actionable" s={perf.data!.actionableLast100} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <SliceTable title="Last 10 · all picks" s={perf.data!.last10} />
              <SliceTable title="Last 50 · all picks" s={perf.data!.last50} />
              <SliceTable title="Last 100 · all picks" s={perf.data!.last100} />
            </div>

            <div className="rounded-2xl border border-cyan-500/20 bg-white/[0.02] p-5 space-y-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/90 font-bold">
                Edge vs outcome (1X2)
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">{perf.data!.edgeVsOutcome.note}</p>
              <p className="text-sm text-slate-300">
                Sample:{" "}
                <span className="font-mono tabular-nums text-slate-200">{perf.data!.edgeVsOutcome.sampleSize}</span>{" "}
                recent actionable settlements · Pearson r (valueScore vs hit):{" "}
                <span className="font-mono tabular-nums text-cyan-200">
                  {perf.data!.edgeVsOutcome.pearsonR != null ? perf.data!.edgeVsOutcome.pearsonR.toFixed(3) : "—"}
                </span>
              </p>
              {perf.data!.edgeVsOutcome.quintiles.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="text-slate-500 text-[11px] uppercase tracking-wider">
                        <th className="py-2 pr-4">Edge bucket</th>
                        <th className="py-2 pr-4">n</th>
                        <th className="py-2 pr-4">Avg value score</th>
                        <th className="py-2">1X2 hit rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perf.data!.edgeVsOutcome.quintiles.map((row) => (
                        <tr key={row.label} className="border-t border-white/[0.06] text-slate-200">
                          <td className="py-2 pr-4">{row.label}</td>
                          <td className="py-2 pr-4 tabular-nums">{row.n}</td>
                          <td className="py-2 pr-4 font-mono tabular-nums">{row.avgValueScore.toFixed(4)}</td>
                          <td className="py-2 tabular-nums text-sky-200">{(row.hitRate * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Not enough rows to bucket.</p>
              )}
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
                Confidence calibration (actionable picks)
              </p>
              <p className="text-xs text-slate-500">
                For each decile of headline confidence: average confidence vs realized 1X2 hit rate. Well-calibrated bins
                track the diagonal; large gaps indicate miscalibration.
              </p>
              {perf.data!.calibration.length === 0 ? (
                <p className="text-sm text-slate-500">Not enough settled actionable picks to bin.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="text-slate-500 text-[11px] uppercase tracking-wider">
                        <th className="py-2 pr-4">Bin</th>
                        <th className="py-2 pr-4">n</th>
                        <th className="py-2 pr-4">Avg conf.</th>
                        <th className="py-2">Hit rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perf.data!.calibration.map((row) => (
                        <tr key={row.binLabel} className="border-t border-white/[0.06] text-slate-200">
                          <td className="py-2 pr-4 font-mono text-xs">{row.binLabel}</td>
                          <td className="py-2 pr-4 tabular-nums">{row.n}</td>
                          <td className="py-2 pr-4">
                            <span className="tabular-nums">{(row.avgConfidence * 100).toFixed(1)}%</span>
                            <div className="mt-1 h-1 max-w-[7rem] rounded-full bg-white/[0.08] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-slate-500/60"
                                style={{ width: `${Math.min(100, row.avgConfidence * 100)}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-2">
                            <span className="tabular-nums text-sky-200">
                              {(row.outcomeHitRate * 100).toFixed(1)}%
                            </span>
                            <div className="mt-1 h-1 max-w-[7rem] rounded-full bg-white/[0.08] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-cyan-400/65"
                                style={{ width: `${Math.min(100, row.outcomeHitRate * 100)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <section className="space-y-5">
        <h2 className="text-lg font-bold text-white font-display">Operating principles</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {d.pillars.map((p, i) => (
            <div
              key={p}
              className="group rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-transparent p-5 transition-all duration-300 hover:border-fuchsia-400/30 hover:shadow-[0_16px_40px_-24px_rgba(232,121,249,0.35)] md:p-6"
            >
              <p className="font-mono text-[11px] font-bold tracking-widest text-fuchsia-300/90">
                {String(i + 1).padStart(2, "0")}
              </p>
              <p className="text-sm text-slate-300 leading-relaxed mt-3">{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass rounded-[1.75rem] p-6 md:p-8 space-y-3 border border-amber-500/25 bg-amber-500/[0.06]">
        <h2 className="text-lg font-bold text-amber-100 font-display">Compliance posture</h2>
        {d.disclaimers.map((x) => (
          <p key={x} className="text-sm text-amber-100/85 leading-relaxed">
            {x}
          </p>
        ))}
      </section>
    </div>
  );
}

import type { MatchTrackContext, MatchReliabilityLabel } from "@/lib/performanceTypes";

function reliabilityChip(label: MatchReliabilityLabel | null): { text: string; className: string } | null {
  if (!label) return null;
  switch (label) {
    case "historically_strong":
      return {
        text: "Historically strong",
        className: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
      };
    case "underperforming":
      return {
        text: "Low reliability",
        className: "border-rose-400/35 bg-rose-950/40 text-rose-100/95",
      };
    case "in_line":
      return {
        text: "In line with confidence",
        className: "border-sky-400/30 bg-sky-950/30 text-sky-100/90",
      };
    case "low_sample":
      return {
        text: "Not enough history yet",
        className: "border-amber-400/35 bg-amber-950/35 text-amber-100/90",
      };
    default:
      return null;
  }
}

export function MatchTrackRecordPanel({
  ctx,
  volatilityScore,
}: {
  ctx: MatchTrackContext | null | undefined;
  volatilityScore?: number;
}) {
  if (!ctx) return null;

  const highVar = volatilityScore != null && Number.isFinite(volatilityScore) && volatilityScore >= 65;
  const rel = reliabilityChip(ctx.reliabilityLabel);

  if (ctx.insufficientHistory) {
    if (ctx.mockExcluded) {
      return (
        <div className="rounded-2xl border border-slate-500/30 bg-slate-950/40 p-5 text-sm leading-relaxed">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Platform track record</p>
          <p className="mt-2 font-semibold text-slate-100">Demo / synthetic path</p>
          {ctx.note ? <p className="mt-2 text-slate-400">{ctx.note}</p> : null}
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-950/25 p-5 text-sm leading-relaxed">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/90">Platform track record</p>
        <p className="mt-2 font-semibold text-amber-50">Not enough history yet</p>
        {ctx.note ? <p className="mt-2 text-slate-400">{ctx.note}</p> : null}
      </div>
    );
  }

  const bin = ctx.calibrationBin;
  const confPct = ctx.headlineConfidencePct;

  return (
    <section className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.07] to-transparent p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-200/90">Tested, not guessing</p>
        {highVar ? (
          <span className="rounded-full border border-fuchsia-400/35 bg-fuchsia-950/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fuchsia-100">
            High variance
          </span>
        ) : null}
        {rel ? (
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${rel.className}`}>
            {rel.text}
          </span>
        ) : null}
      </div>

      {bin ? (
        <>
          <p className="text-sm text-slate-200 leading-relaxed">
            Headline confidence on this card is about{" "}
            <span className="font-mono tabular-nums text-emerald-200">{confPct}%</span> — that maps to the{" "}
            <span className="text-white font-semibold">{bin.binLabel}</span> band on settled picks.
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            In that band, past picks averaged{" "}
            <span className="font-mono tabular-nums text-cyan-200">{(bin.avgConfidence * 100).toFixed(0)}%</span>{" "}
            headline confidence and realized{" "}
            <span className="font-mono tabular-nums text-emerald-200">
              {(bin.historical1x2HitRate * 100).toFixed(0)}%
            </span>{" "}
            1X2 accuracy after full time{" "}
            <span className="text-slate-500">
              (n={bin.n}
              {bin.calibrationGap !== 0 ? (
                <>
                  {" "}
                  · gap {(bin.calibrationGap * 100).toFixed(1)} pp vs confidence
                </>
              ) : null}
              ).
            </span>
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-400 leading-relaxed">
          {ctx.note ?? "Calibration for this confidence decile will appear once enough similar picks have settled."}
        </p>
      )}
    </section>
  );
}

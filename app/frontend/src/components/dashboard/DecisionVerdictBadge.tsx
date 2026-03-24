"use client";

import type { DecisionVerdict } from "@/lib/decisionVerdict";

const styles: Record<DecisionVerdict, string> = {
  TAKE: "border-emerald-400/50 bg-emerald-500/20 text-emerald-100 shadow-[0_0_24px_rgba(52,211,153,0.15)]",
  AVOID: "border-rose-400/45 bg-rose-950/40 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.12)]",
  WATCH: "border-sky-400/45 bg-sky-500/15 text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.12)]",
};

const hint: Record<DecisionVerdict, string> = {
  TAKE: "Model sees edge vs market — review stake & risk, then open breakdown.",
  AVOID: "Do not treat as value — trap flag, NO BET, or confidence too low.",
  WATCH: "Line or model moved — monitor before staking.",
};

export function DecisionVerdictBadge({ verdict }: { verdict: DecisionVerdict }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-t-xl border px-3 py-2 ${styles[verdict]}`}
      title={hint[verdict]}
    >
      <span className="text-[10px] font-black uppercase tracking-[0.35em]">{verdict}</span>
      <span className="hidden max-w-[min(100%,20rem)] text-[10px] font-medium leading-snug opacity-80 md:inline">
        {hint[verdict]}
      </span>
    </div>
  );
}

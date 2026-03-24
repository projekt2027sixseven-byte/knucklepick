"use client";

import Link from "next/link";

type Props = {
  updatedLabel: string | null;
  counts: {
    topEdges: number;
    valuePicks: number;
    traps: number;
    avoidWeak: number;
    recentlyUpdated: number;
    skipTotal: number;
  };
  showSignIn?: boolean;
};

const anchors = [
  { href: "#decisions", label: "Best" },
  { href: "#more-edges", label: "More" },
  { href: "#skip", label: "Skip" },
  { href: "#watch", label: "Watch" },
  { href: "#all-fixtures", label: "All" },
];

export function DeckSummaryBar({ updatedLabel, counts, showSignIn }: Props) {
  return (
    <div className="sticky top-14 z-20 -mx-4 border-b border-white/[0.08] bg-dream-ink/[0.92] px-4 py-3 backdrop-blur-xl lg:top-0 lg:mx-0 lg:rounded-2xl lg:border lg:border-white/[0.08] lg:py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-fuchsia-300/90">What to do now</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-display text-xl font-bold text-white md:text-2xl">Decision deck</h1>
            {updatedLabel ? (
              <span className="text-xs tabular-nums text-slate-500">Updated {updatedLabel}</span>
            ) : null}
          </div>
          <p className="mt-1 max-w-xl text-xs text-slate-500">
            <span className="text-emerald-200/90">TAKE</span> the top row, <span className="text-rose-200/85">AVOID</span>{" "}
            traps & weak rows, <span className="text-sky-200/85">WATCH</span> line moves — not a full data dump.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/12 px-3 py-1.5 text-[11px] font-semibold tabular-nums text-emerald-100">
            TAKE {counts.topEdges}
          </span>
          <span className="rounded-full border border-orange-400/25 bg-orange-500/10 px-3 py-1.5 text-[11px] font-semibold tabular-nums text-orange-100">
            +More {counts.valuePicks}
          </span>
          <span className="rounded-full border border-rose-400/30 bg-rose-950/35 px-3 py-1.5 text-[11px] font-semibold tabular-nums text-rose-100">
            AVOID {counts.skipTotal}
          </span>
          <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-[11px] font-semibold tabular-nums text-sky-100">
            WATCH {counts.recentlyUpdated}
          </span>
        </div>
      </div>
      <nav className="mt-3 flex gap-1 overflow-x-auto pb-0.5 text-[11px] font-semibold" aria-label="Decision sections">
        {anchors.map((a) => (
          <a
            key={a.href}
            href={a.href}
            className="shrink-0 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-slate-400 transition-colors hover:border-fuchsia-500/30 hover:text-fuchsia-100"
          >
            {a.label}
          </a>
        ))}
        {showSignIn ? (
          <Link
            href="/account"
            className="ml-auto shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-100 hover:bg-amber-500/15"
          >
            Sign in
          </Link>
        ) : null}
      </nav>
    </div>
  );
}

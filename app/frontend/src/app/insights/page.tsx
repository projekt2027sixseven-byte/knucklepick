"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type PlatformInsight = {
  product: string;
  tagline: string;
  modelVersion: string;
  lastModelRun: string | null;
  fixturesIndexed48h: number;
  pillars: string[];
  disclaimers: string[];
};

export default function InsightsPage() {
  const q = useQuery({
    queryKey: ["insights-platform"],
    queryFn: () => apiFetch<PlatformInsight>("/api/insights/platform"),
  });

  if (q.isLoading) {
    return (
      <div className="space-y-6 animate-pulse max-w-3xl">
        <div className="h-36 rounded-3xl bg-white/5" />
        <div className="h-48 rounded-3xl bg-white/5" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="glass rounded-2xl p-8 border border-rose-500/20 text-rose-200 text-sm">
        {(q.error as Error).message}
      </div>
    );
  }
  const d = q.data!;

  return (
    <div className="space-y-10 pb-8 max-w-4xl">
      <div className="glass-strong rounded-3xl p-8 md:p-10 border border-white/10 space-y-4">
        <p className="page-eyebrow">Trust center</p>
        <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">{d.product}</h1>
        <p className="text-slate-400 text-lg leading-relaxed">{d.tagline}</p>
        <div className="flex flex-wrap gap-4 text-sm text-slate-300 mt-4">
          <span className="rounded-full border border-white/15 px-3 py-1">Model {d.modelVersion}</span>
          <span className="rounded-full border border-white/15 px-3 py-1">
            Last run {d.lastModelRun ? new Date(d.lastModelRun).toLocaleString() : "—"}
          </span>
          <span className="rounded-full border border-white/15 px-3 py-1">
            Fixtures (48h) {d.fixturesIndexed48h}
          </span>
        </div>
      </div>

      <section className="glass rounded-3xl p-6 space-y-4 border border-white/5">
        <h2 className="text-lg font-semibold text-white">Operating principles</h2>
        <ul className="space-y-3 text-sm text-slate-300">
          {d.pillars.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="text-cyan-300">▹</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass rounded-3xl p-6 space-y-3 border border-amber-500/20 bg-amber-500/5">
        <h2 className="text-lg font-semibold text-amber-100">Compliance posture</h2>
        {d.disclaimers.map((x) => (
          <p key={x} className="text-sm text-amber-100/80 leading-relaxed">
            {x}
          </p>
        ))}
      </section>
    </div>
  );
}

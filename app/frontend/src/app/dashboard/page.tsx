"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { MatchCard, type MatchCardProps } from "@/components/MatchCard";
import { FiltersPanel } from "@/components/FiltersPanel";
import { EmptyState } from "@/components/EmptyState";
import { PRODUCT_NAME } from "@/lib/constants";

type MatchRow = {
  id: string;
  utcDate: string;
  oddsFetchedAt?: string | null;
  homeTeam: { name: string };
  awayTeam: { name: string };
  league?: { name: string } | null;
  isWatched?: boolean;
  prediction?: MatchCardProps["prediction"];
};

type DashboardPayload = {
  matches: MatchRow[];
  topPicks: MatchRow[];
  valueBets: MatchRow[];
  traps: MatchRow[];
};

function Section({
  title,
  subtitle,
  badge,
  children,
  empty,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-semibold text-white tracking-tight">{title}</h2>
            {badge ? (
              <span className="text-[10px] uppercase tracking-wider font-semibold text-cyan-300/90 border border-cyan-400/30 rounded-full px-2 py-0.5">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">{subtitle}</p>
        </div>
      </div>
      {empty ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center text-sm text-slate-500">
          No fixtures in this rail yet — check back after the next model refresh or widen filters.
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function Grid({ rows }: { rows: MatchRow[] }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {rows.map((m) => (
        <MatchCard
          key={m.id}
          id={m.id}
          home={m.homeTeam.name}
          away={m.awayTeam.name}
          league={m.league?.name}
          utcDate={m.utcDate}
          oddsFetchedAt={m.oddsFetchedAt}
          isWatched={m.isWatched}
          prediction={m.prediction ?? null}
        />
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-40 rounded-3xl bg-white/5" />
      <div className="h-12 rounded-xl bg-white/5 max-w-md" />
      <div className="grid md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const token = useAuthStore((s) => s.token);
  const [leagueId, setLeagueId] = useState("");
  const q = useQuery({
    queryKey: ["matches", leagueId, token],
    queryFn: () => {
      const qs = leagueId ? `?leagueId=${encodeURIComponent(leagueId)}` : "";
      return apiFetch<DashboardPayload>(`/api/matches${qs}`, { token: token ?? undefined });
    },
  });

  if (q.isLoading) {
    return <LoadingSkeleton />;
  }
  if (q.isError) {
    return (
      <EmptyState
        title="Couldn’t load the grid"
        description={(q.error as Error).message || "Check your connection and try again."}
        action={{ label: "Retry", href: "/dashboard" }}
        secondary={{ label: "Go home", href: "/" }}
      />
    );
  }
  const data = q.data!;
  const updated =
    q.dataUpdatedAt != null
      ? new Date(q.dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : null;

  const emptyAll = data.matches.length === 0;

  return (
    <div className="space-y-12 md:space-y-14">
      <div className="glass-strong rounded-3xl p-8 md:p-10 border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <p className="page-eyebrow">Live desk</p>
          <h1 className="page-title mt-3">{PRODUCT_NAME} intelligence grid</h1>
          <p className="text-slate-400 mt-4 max-w-3xl leading-relaxed">
            Trust-ranked picks, value surfaces, and trap surveillance — each card shows calibrated context, freshness,
            and governance flags so you scan with confidence.
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-6 text-xs text-slate-500">
            {updated ? <span>Grid refreshed · {updated}</span> : null}
            <span className="hidden sm:inline">·</span>
            <span>Sort by trust on signal desk · validate edges on value surface</span>
          </div>
          {!token ? (
            <p className="text-sm text-amber-200/90 mt-5 border border-amber-500/25 rounded-xl px-4 py-3 bg-amber-500/5 inline-block">
              <Link href="/account" className="text-amber-100 font-semibold hover:underline">
                Sign in
              </Link>{" "}
              to sync watchlists, save vault snapshots, and unlock full premium breakdowns on each match.
            </p>
          ) : null}
        </div>
      </div>

      <FiltersPanel leagueId={leagueId} onLeagueChange={setLeagueId} />

      {emptyAll ? (
        <EmptyState
          title="No fixtures in view"
          description="The pipeline may still be ingesting, or filters may be too narrow. Try clearing the league filter or run an admin refresh."
          action={{ label: "Trust center", href: "/insights" }}
          secondary={{ label: "Plans", href: "/pricing" }}
        />
      ) : (
        <>
          <Section
            title="Today’s top AI picks"
            subtitle="Highest trust index among open fixtures — your fastest scan path."
            badge="Signal"
            empty={data.topPicks.length === 0}
          >
            <Grid rows={data.topPicks} />
          </Section>

          <Section
            title="Value surface"
            subtitle="Where the model disagrees most with the market after calibration — still subject to NO BET policy."
            badge="Edge"
            empty={data.valueBets.length === 0}
          >
            <Grid rows={data.valueBets} />
          </Section>

          <Section
            title="Trap radar"
            subtitle="Heavy market conviction with skeptical model posture — investigate before sizing."
            badge="Risk"
            empty={data.traps.length === 0}
          >
            <Grid rows={data.traps} />
          </Section>

          <Section
            title="Full fixture horizon"
            subtitle="Everything in scope — scroll or filter by league."
            empty={false}
          >
            <Grid rows={data.matches} />
          </Section>
        </>
      )}
    </div>
  );
}

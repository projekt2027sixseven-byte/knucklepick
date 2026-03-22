"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";

type Pick = {
  id: string;
  label?: string | null;
  status: string;
  snapshot: Record<string, unknown>;
  match: {
    id: string;
    utcDate: string;
    homeTeam: { name: string };
    awayTeam: { name: string };
    league?: { name: string } | null;
  };
};

export default function PicksPage() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["picks", token],
    enabled: Boolean(token),
    queryFn: () => apiFetch<{ picks: Pick[] }>("/api/picks", { token }),
  });

  async function remove(id: string) {
    if (!token) return;
    await apiFetch(`/api/picks/${id}`, { method: "DELETE", token });
    await qc.invalidateQueries({ queryKey: ["picks"] });
  }

  if (!token) {
    return (
      <EmptyState
        title="Vault stores your pick snapshots"
        description="Freeze model confidence, trust, and book context at save time — ideal for post-match review and process discipline."
        action={{ label: "Sign in", href: "/account" }}
        secondary={{ label: "Browse matches", href: "/dashboard" }}
      />
    );
  }
  if (q.isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-40 rounded-lg bg-white/10" />
        <div className="h-40 rounded-2xl bg-white/5" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <EmptyState
        title="Couldn’t open vault"
        description={(q.error as Error).message}
        action={{ label: "Retry", href: "/picks" }}
      />
    );
  }

  const picks = q.data?.picks ?? [];

  return (
    <div className="space-y-10 pb-8 max-w-3xl">
      <div>
        <p className="page-eyebrow">Immutable snapshots</p>
        <h1 className="page-title mt-2">Vault</h1>
        <p className="text-slate-400 mt-3 leading-relaxed">
          Each entry is a frozen snapshot — compare what the model saw at save time with the final result.
        </p>
      </div>

      {picks.length === 0 ? (
        <EmptyState
          title="Vault is empty"
          description="Open any match breakdown and tap Save pick to capture odds context, confidence, and trust for later review."
          action={{ label: "Intelligence grid", href: "/dashboard" }}
        />
      ) : (
        <div className="space-y-4">
          {picks.map((pk) => (
            <div key={pk.id} className="card-premium p-5 flex flex-wrap justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500">{pk.match.league?.name ?? "Fixture"}</p>
                <Link
                  href={`/match/${pk.match.id}`}
                  className="text-lg font-semibold text-white hover:text-cyan-200 transition-colors"
                >
                  {pk.match.homeTeam.name} vs {pk.match.awayTeam.name}
                </Link>
                <p className="text-xs text-slate-500 mt-1">{new Date(pk.match.utcDate).toLocaleString()}</p>
                {pk.label ? <p className="text-sm text-slate-400 mt-3">{pk.label}</p> : null}
                <details className="mt-4 group">
                  <summary className="text-xs text-cyan-300/80 cursor-pointer hover:text-cyan-200">
                    Snapshot JSON
                  </summary>
                  <pre className="text-[11px] text-slate-500 mt-2 bg-black/40 rounded-lg p-3 overflow-x-auto max-w-full">
                    {JSON.stringify(pk.snapshot, null, 2)}
                  </pre>
                </details>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">{pk.status}</span>
                <button
                  type="button"
                  onClick={() => remove(pk.id)}
                  className="text-xs text-rose-300/90 hover:text-rose-200 font-medium"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

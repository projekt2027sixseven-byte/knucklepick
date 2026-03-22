"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

type Me = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  entitlements?: {
    dailyMatchLimit: number;
    planSlug: string;
    watchlistLimit: number;
    savedPickLimit: number;
    digestEnabled: boolean;
    apiAccess: boolean;
  };
  engagement?: { signals7d: number; watchlistCount: number; openSavedPicks: number; viewsToday: number };
  subscription?: {
    status: string;
    plan: {
      slug: string;
      name: string;
      dailyMatchLimit: number;
      watchlistLimit?: number;
      savedPickLimit?: number;
      digestEnabled?: boolean;
    };
    currentPeriodEnd: string | null;
  } | null;
};

function UsageBar({ label, used, cap }: { label: string; used: number; cap: number }) {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1.5">
        <span>{label}</span>
        <span>
          {used} / {cap < 0 ? "∞" : cap}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct > 85 ? "bg-amber-400" : "bg-gradient-to-r from-cyan-400 to-violet-500"}`}
          style={{ width: `${cap < 0 ? 8 : pct}%` }}
        />
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { token, setAuth, logout, user } = useAuthStore();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("demo@matchoracle.local");
  const [password, setPassword] = useState("Demo12345678!");
  const [name, setName] = useState("Demo Analyst");
  const [error, setError] = useState<string | null>(null);

  const me = useQuery({
    queryKey: ["me", token],
    enabled: Boolean(token),
    queryFn: () => apiFetch<Me>("/api/auth/me", { token }),
  });

  const prefs = useQuery({
    queryKey: ["prefs", token],
    enabled: Boolean(token),
    queryFn: () =>
      apiFetch<{
        preferences: { digestEnabled: boolean; digestHourUtc: number };
        entitlements: { digestEnabled: boolean };
      }>("/api/me/preferences", { token }),
  });

  async function toggleDigest() {
    if (!token || !prefs.data) return;
    const next = !prefs.data.preferences.digestEnabled;
    await apiFetch("/api/me/preferences", {
      method: "PUT",
      token,
      body: JSON.stringify({ digestEnabled: next }),
    });
    await prefs.refetch();
    await qc.invalidateQueries({ queryKey: ["me"] });
  }

  async function submit() {
    setError(null);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { email, password } : { email, password, name };
      const res = await apiFetch<{ token: string; user: { id: string; email: string; name?: string; role: string } }>(
        path,
        { method: "POST", body: JSON.stringify(body) }
      );
      setAuth(res.token, res.user);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const ent = me.data?.entitlements;
  const sub = me.data?.subscription;
  const dailyCap = sub?.plan.dailyMatchLimit ?? ent?.dailyMatchLimit ?? 0;
  const viewsToday = me.data?.engagement?.viewsToday ?? 0;
  const wlCap = ent?.watchlistLimit ?? sub?.plan.watchlistLimit ?? 0;
  const vaultCap = ent?.savedPickLimit ?? sub?.plan.savedPickLimit ?? 0;
  const wlUsed = me.data?.engagement?.watchlistCount ?? 0;
  const vaultUsed = me.data?.engagement?.openSavedPicks ?? 0;

  return (
    <div className="max-w-2xl space-y-10 pb-8">
      <div>
        <p className="page-eyebrow">Account</p>
        <h1 className="page-title mt-2">Your workspace</h1>
        <p className="text-slate-400 mt-3 leading-relaxed">
          Plan limits, usage, and digest settings — everything that gates premium depth lives here.
        </p>
      </div>

      {token && user ? (
        <div className="glass-strong rounded-3xl p-6 md:p-8 border border-white/10 space-y-8">
          <div className="flex flex-wrap justify-between gap-4 items-start">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Signed in</p>
              <p className="text-lg font-semibold text-white mt-1">{user.email}</p>
              <p className="text-xs text-slate-500 mt-1">Role · {user.role}</p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="text-sm text-rose-300/90 hover:text-rose-200 font-medium"
            >
              Sign out
            </button>
          </div>

          {me.isLoading ? <p className="text-sm text-slate-500">Loading entitlements…</p> : null}

          {sub ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">Current plan</p>
                  <p className="text-xl font-semibold text-white mt-0.5">{sub.plan.name}</p>
                  <p className="text-xs text-slate-500 mt-1 capitalize">Status · {sub.status.toLowerCase()}</p>
                </div>
                <Link href="/pricing" className="btn-primary text-sm py-2.5 px-5">
                  Upgrade or change
                </Link>
              </div>
              {sub.currentPeriodEnd ? (
                <p className="text-xs text-slate-500">
                  Current period ends {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                </p>
              ) : null}
              {dailyCap >= 0 ? (
                <UsageBar label="Premium match views today" used={viewsToday} cap={dailyCap} />
              ) : (
                <p className="text-sm text-emerald-200/90">Unlimited premium breakdowns on this plan.</p>
              )}
              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                {wlCap >= 0 ? (
                  <UsageBar label="Watchlist slots" used={wlUsed} cap={wlCap} />
                ) : (
                  <p className="text-xs text-slate-500 self-end pb-2">Watchlist · unlimited</p>
                )}
                {vaultCap >= 0 ? (
                  <UsageBar label="Vault snapshots (open)" used={vaultUsed} cap={vaultCap} />
                ) : (
                  <p className="text-xs text-slate-500 self-end pb-2">Vault · unlimited</p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 text-sm text-amber-100">
              No active subscription on file.{" "}
              <Link href="/pricing" className="text-cyan-200 font-semibold underline-offset-2 hover:underline">
                View plans
              </Link>{" "}
              to unlock metered premium depth.
            </div>
          )}

          {me.data?.engagement ? (
            <div className="text-xs text-slate-500 border-t border-white/10 pt-6 grid grid-cols-2 gap-3">
              <p>Signals (7d): {me.data.engagement.signals7d}</p>
              <p>Open vault: {me.data.engagement.openSavedPicks}</p>
            </div>
          ) : null}

          {token && prefs.data ? (
            <div className="border-t border-white/10 pt-6 space-y-3">
              <div>
                <p className="font-semibold text-white">Morning digest</p>
                <p className="text-xs text-slate-500 mt-1">
                  {prefs.data.entitlements.digestEnabled
                    ? "Included on your plan — fan-out runs on the server schedule (UTC)."
                    : "Upgrade to Pro for digest automation when your plan allows."}
                </p>
              </div>
              <button
                type="button"
                disabled={!prefs.data.entitlements.digestEnabled}
                onClick={() => toggleDigest()}
                className="rounded-full border border-white/20 px-5 py-2 text-xs font-semibold text-white hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {prefs.data.preferences.digestEnabled ? "Turn digest off" : "Enable digest"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="glass rounded-3xl p-6 md:p-8 border border-white/10 space-y-5">
        <div className="flex gap-2 p-1 rounded-full bg-white/5 w-fit">
          <button
            type="button"
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              mode === "login" ? "bg-white/15 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              mode === "register" ? "bg-white/15 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>
        {mode === "register" ? (
          <label className="block text-sm">
            <span className="text-slate-400">Name</span>
            <input
              className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        ) : null}
        <label className="block text-sm">
          <span className="text-slate-400">Email</span>
          <input
            className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Password</span>
          <input
            type="password"
            className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p className="text-rose-300 text-sm">{error}</p> : null}
        <button
          type="button"
          onClick={() => submit()}
          className="w-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 py-3 font-semibold hover:opacity-95 transition-opacity"
        >
          {mode === "login" ? "Sign in" : "Create account"}
        </button>
        {process.env.NODE_ENV === "development" ? (
          <p className="text-[11px] text-slate-600">
            Local dev: seeded admin may exist — rotate credentials before production.
          </p>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

type Me = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  hasStripeCustomer?: boolean;
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
      <div className="flex justify-between text-xs text-slate-500 mb-1.5 font-medium">
        <span>{label}</span>
        <span className="tabular-nums">
          {used} / {cap < 0 ? "∞" : cap}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden ring-1 ring-white/[0.05]">
        <div
          className={`h-full rounded-full transition-all ${pct > 85 ? "bg-knuckle-heat" : "bg-gradient-to-r from-knuckle-primary to-sky-400"}`}
          style={{ width: `${cap < 0 ? 8 : pct}%` }}
        />
      </div>
    </div>
  );
}

export default function AccountClient() {
  const searchParams = useSearchParams();
  const { token, setAuth, logout, user } = useAuthStore();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<{ text: string; tone: "success" | "warn" | "neutral" } | null>(
    null
  );
  const [portalBusy, setPortalBusy] = useState(false);

  const me = useQuery({
    queryKey: ["me", token],
    enabled: Boolean(token),
    queryFn: () => apiFetch<Me>("/api/auth/me", { token }),
    retry: 1,
  });

  const prefs = useQuery({
    queryKey: ["prefs", token],
    enabled: Boolean(token),
    queryFn: () =>
      apiFetch<{
        preferences: { digestEnabled: boolean; digestHourUtc: number };
        entitlements: { digestEnabled: boolean };
      }>("/api/me/preferences", { token }),
    retry: 1,
  });

  const billingCaps = useQuery({
    queryKey: ["billing-capabilities"],
    queryFn: () =>
      apiFetch<{
        stripe: boolean;
        subscriptionCheckout: boolean;
        customerPortal: boolean;
        digestEmail: boolean;
      }>("/api/billing/capabilities"),
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    const session = searchParams.get("session");
    const checkout = searchParams.get("checkout");
    if (session === "expired") {
      setCheckoutNotice({ text: "Your session expired. Sign in again to continue.", tone: "warn" });
      return;
    }
    if (checkout === "success") {
      setCheckoutNotice({ text: "Payment succeeded — refreshing your plan.", tone: "success" });
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["prefs"] });
      return;
    }
    if (checkout === "cancel") {
      setCheckoutNotice({ text: "Checkout was cancelled — no plan changes were made.", tone: "neutral" });
    }
  }, [searchParams, qc]);

  async function openBillingPortal() {
    if (!token) return;
    setPortalBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ url: string | null }>("/api/billing/portal", {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });
      if (res.url) window.location.href = res.url;
      else setError("Portal URL unavailable.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPortalBusy(false);
    }
  }

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
      await qc.invalidateQueries();
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

  const digestEmailLive = billingCaps.data?.digestEmail ?? false;

  return (
    <div className="max-w-2xl space-y-10 pb-8">
      <div>
        <p className="page-eyebrow">Account</p>
        <h1 className="page-title mt-3">Your workspace</h1>
        <p className="text-slate-400 mt-4 leading-relaxed">
          Plan limits, usage, and digest settings — everything that gates premium depth lives here.
        </p>
      </div>

      {checkoutNotice ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            checkoutNotice.tone === "success"
              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-100"
              : checkoutNotice.tone === "warn"
                ? "border-rose-500/35 bg-rose-500/10 text-rose-100"
                : "border-white/15 bg-white/[0.04] text-slate-200"
          }`}
        >
          {checkoutNotice.text}
        </div>
      ) : null}

      {token && user ? (
        <div className="glass-strong rounded-[1.75rem] p-6 md:p-8 border border-white/[0.08] space-y-8">
          <div className="flex flex-wrap justify-between gap-4 items-start">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-600 font-bold">Signed in</p>
              <p className="text-lg font-bold text-white mt-1 font-display">{user.email}</p>
              <p className="text-xs text-slate-500 mt-1">Role · {user.role}</p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="text-sm text-rose-300/90 hover:text-rose-200 font-semibold transition-colors"
            >
              Sign out
            </button>
          </div>

          {me.isLoading ? <p className="text-sm text-slate-500">Loading entitlements…</p> : null}
          {me.isError ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-500/25 bg-rose-950/20 px-4 py-3">
              <p className="text-sm text-rose-200">{(me.error as Error).message}</p>
              <button
                type="button"
                onClick={() => void me.refetch()}
                className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-white/[0.06]"
              >
                Retry
              </button>
            </div>
          ) : null}

          {sub ? (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Current plan</p>
                  <p className="text-xl font-bold text-white mt-1 font-display">{sub.plan.name}</p>
                  <p className="text-xs text-slate-500 mt-1 capitalize">Status · {sub.status.toLowerCase()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {billingCaps.data?.customerPortal && me.data?.hasStripeCustomer ? (
                    <button
                      type="button"
                      disabled={portalBusy}
                      onClick={() => void openBillingPortal()}
                      className="btn-primary text-sm py-2.5 px-5 disabled:opacity-50"
                    >
                      {portalBusy ? "Opening…" : "Manage subscription"}
                    </button>
                  ) : null}
                  <Link href="/pricing" className="btn-primary text-sm py-2.5 px-5 inline-flex items-center">
                    {billingCaps.data?.subscriptionCheckout ? "Change plan" : "Plans"}
                  </Link>
                </div>
              </div>
              {!billingCaps.data?.stripe ? (
                <p className="text-xs text-amber-200/90">Stripe is not configured on the API — checkout and portal are unavailable.</p>
              ) : null}
              {sub.currentPeriodEnd ? (
                <p className="text-xs text-slate-500">
                  Current period ends {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                </p>
              ) : null}
              {dailyCap >= 0 ? (
                <UsageBar label="Premium match views today" used={viewsToday} cap={dailyCap} />
              ) : (
                <p className="text-sm text-emerald-300/90 font-medium">Unlimited premium breakdowns on this plan.</p>
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
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-6 text-sm text-amber-100">
              No active subscription on file.{" "}
              <Link href="/pricing" className="text-knuckle-primary font-bold underline-offset-2 hover:underline">
                View plans
              </Link>{" "}
              to unlock metered premium depth.
            </div>
          )}

          {me.data?.engagement ? (
            <div className="text-xs text-slate-500 border-t border-white/[0.07] pt-6 grid grid-cols-2 gap-3">
              <p>Signals (7d): {me.data.engagement.signals7d}</p>
              <p>Open vault: {me.data.engagement.openSavedPicks}</p>
            </div>
          ) : null}

          {prefs.isError ? (
            <div className="border-t border-white/[0.07] pt-6 flex flex-wrap items-center gap-3">
              <p className="text-sm text-rose-300">{(prefs.error as Error).message}</p>
              <button
                type="button"
                onClick={() => void prefs.refetch()}
                className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-white/[0.06]"
              >
                Retry
              </button>
            </div>
          ) : null}

          {token && prefs.data ? (
            <div className="border-t border-white/[0.07] pt-6 space-y-3">
              <div>
                <p className="font-bold text-white font-display">Morning digest</p>
                <p className="text-xs text-slate-500 mt-1">
                  {prefs.data.entitlements.digestEnabled
                    ? digestEmailLive
                      ? "When enabled, the server sends a daily email at the scheduled UTC window (requires Resend + verified sender on the API)."
                      : "Digest email is not configured on the server (set RESEND_API_KEY and DIGEST_FROM_EMAIL). You can still preview in-app from the API when your plan allows."
                    : "Upgrade to Pro for digest automation when your plan allows."}
                </p>
              </div>
              <button
                type="button"
                disabled={!prefs.data.entitlements.digestEnabled}
                onClick={() => toggleDigest()}
                className="rounded-full border border-white/20 px-5 py-2 text-xs font-bold text-white hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {prefs.data.preferences.digestEnabled ? "Turn digest off" : "Enable digest"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {token && !user ? (
        <p className="text-sm text-slate-500">Loading session…</p>
      ) : null}

      {!token ? (
        <div className="glass rounded-[1.75rem] p-6 md:p-8 border border-white/[0.08] space-y-5">
          <div>
            <p className="page-eyebrow">Access</p>
            <h2 className="text-lg font-bold text-white font-display mt-2">Sign in or register</h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Same account unlocks the deck, watchlist, vault saves, and metered match breakdowns.
            </p>
          </div>
          <div className="flex gap-2 p-1 rounded-full bg-white/[0.05] w-fit border border-white/[0.06]">
            <button
              type="button"
              className={`px-5 py-2 rounded-full text-sm font-bold transition-colors ${
                mode === "login" ? "bg-knuckle-primary text-white shadow-glow" : "text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setMode("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`px-5 py-2 rounded-full text-sm font-bold transition-colors ${
                mode === "register" ? "bg-knuckle-primary text-white shadow-glow" : "text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setMode("register")}
            >
              Register
            </button>
          </div>
          {mode === "register" ? (
            <label className="block text-sm">
              <span className="text-slate-500 font-medium">Name</span>
              <input
                className="mt-1.5 w-full bg-knuckle-bg/80 border border-white/12 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-knuckle-primary/35"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>
          ) : null}
          <label className="block text-sm">
            <span className="text-slate-500 font-medium">Email</span>
            <input
              className="mt-1.5 w-full bg-knuckle-bg/80 border border-white/12 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-knuckle-primary/35"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500 font-medium">Password</span>
            <input
              type="password"
              className="mt-1.5 w-full bg-knuckle-bg/80 border border-white/12 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-knuckle-primary/35"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {error ? <p className="text-rose-300 text-sm">{error}</p> : null}
          <button
            type="button"
            onClick={() => submit()}
            className="w-full rounded-full bg-gradient-to-r from-knuckle-primary to-sky-400 text-white py-3.5 font-bold hover:brightness-105 transition-all shadow-glow"
          >
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
          <p className="text-center text-xs text-slate-500">
            After signing in, open the{" "}
            <Link href="/dashboard" className="font-semibold text-fuchsia-300 hover:text-fuchsia-200">
              Deck
            </Link>{" "}
            for today&apos;s edges.
          </p>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

const tiers = [
  {
    slug: "starter" as const,
    name: "Starter",
    price: "$19",
    period: "/mo",
    headline: "Serious solo analysts",
    limit: "5 premium match breakdowns / day",
    limits: ["Watchlist & vault caps per plan", "Core confidence + risk rails", "Email support"],
    highlighted: false,
  },
  {
    slug: "pro" as const,
    name: "Pro",
    price: "$49",
    period: "/mo",
    headline: "Daily desk workflow",
    limit: "20 premium match breakdowns / day",
    limits: [
      "Similarity cohort stats & scenarios",
      "Morning digest email (when API mail is configured)",
      "Deeper market vs model context",
    ],
    highlighted: true,
    badge: "Best value",
  },
  {
    slug: "ultimate" as const,
    name: "Ultimate",
    price: "$129",
    period: "/mo",
    headline: "No-compromise depth",
    limit: "Unlimited premium breakdowns",
    limits: ["API-grade outputs flag", "Priority ingestion posture", "Highest watchlist / vault ceilings"],
    highlighted: false,
  },
];

const comparison = [
  { feature: "Premium match breakdowns / day", starter: "5", pro: "20", ultimate: "∞" },
  { feature: "Trust + risk + NO BET governance", starter: "✓", pro: "✓", ultimate: "✓" },
  { feature: "Exact score + scenario lattice", starter: "✓", pro: "✓", ultimate: "✓" },
  { feature: "Historical similarity cohort", starter: "Limited", pro: "Full", ultimate: "Full" },
  { feature: "Morning digest email (server + mail provider)", starter: "—", pro: "✓", ultimate: "✓" },
  { feature: "API-grade / automation flag", starter: "—", pro: "—", ultimate: "✓" },
];

const faq = [
  {
    q: "What counts as a “premium breakdown”?",
    a: "Opening a full match detail with calibrated probabilities, similarity, scenarios, and factor breakdown — metered per day on Starter/Pro.",
  },
  {
    q: "Can I upgrade mid-cycle?",
    a: "Stripe Checkout handles plan changes; proration depends on your Stripe configuration. Use Account to see current entitlements.",
  },
  {
    q: "Is there a free trial?",
    a: "Create an account to explore the deck; premium depth is gated by plan. Contact sales for pilot programs.",
  },
];

export default function PricingPage() {
  const token = useAuthStore((s) => s.token);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const caps = useQuery({
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

  async function checkout(slug: (typeof tiers)[number]["slug"]) {
    setError(null);
    if (!token) {
      setError("Sign in on the Account page first — checkout attaches to your logged-in user.");
      return;
    }
    setLoading(slug);
    try {
      const res = await apiFetch<{ url: string | null }>("/api/billing/checkout", {
        method: "POST",
        token,
        body: JSON.stringify({ planSlug: slug }),
      });
      if (res.url) window.location.href = res.url;
      else setError("Checkout unavailable. Ensure Stripe price IDs are configured on the API.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-16 pb-12">
      <div className="max-w-3xl">
        <p className="page-eyebrow">Pricing</p>
        <h1 className="page-title mt-4">Plans by how much you use</h1>
        <p className="text-slate-400 mt-5 text-lg leading-relaxed">
          Choose a daily breakdown limit that matches your workflow — auditable probabilities and risk-aware tooling,
          not generic tips. Past model performance does not guarantee future results.
        </p>
        {!token ? (
          <p className="mt-6 text-sm text-slate-500">
            Already decided?{" "}
            <Link href="/account" className="text-knuckle-primary font-semibold hover:text-sky-200 transition-colors">
              Sign in
            </Link>{" "}
            first — checkout attaches to your account.
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600 font-medium">
          {caps.isLoading ? (
            <span className="text-slate-500">Checking billing configuration…</span>
          ) : caps.isError ? (
            <span className="text-amber-200/90">
              Couldn&apos;t load billing status. {(caps.error as Error).message}
            </span>
          ) : (
            <>
              <span className="text-slate-400">
                {caps.data?.stripe
                  ? "Checkout via Stripe"
                  : "Stripe not configured on API — subscribe when billing is enabled."}
              </span>
              {caps.data?.customerPortal ? (
                <span>Manage or cancel from Account → Manage subscription (after one checkout)</span>
              ) : (
                <span>Customer portal requires Stripe on the server</span>
              )}
              <span>Stripe emails invoices when checkout is live</span>
            </>
          )}
        </div>
        {!caps.isError && caps.data && !caps.data.digestEmail ? (
          <p className="mt-4 text-xs text-slate-500 leading-relaxed max-w-2xl">
            Morning digest email delivery requires Resend (or compatible) env on the API — see deployment docs. In-app
            digest preview remains available for eligible plans.
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {!caps.isLoading && caps.data && !caps.data.subscriptionCheckout ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/95 leading-relaxed">
          <span className="font-semibold text-amber-50">First public release — </span>
          Paid checkout isn&apos;t enabled on the server yet (Stripe keys or price IDs). You can still use the deck,
          watchlist, and vault on your account; plans show what we intend to offer.
        </div>
      ) : null}

      <div className="grid md:grid-cols-3 gap-5 md:gap-6 items-stretch">
        {tiers.map((t) => (
          <div
            key={t.slug}
            className={`relative flex flex-col rounded-[1.75rem] p-8 border transition-all duration-300 ${
              t.highlighted
                ? "border-knuckle-primary/45 bg-gradient-to-b from-knuckle-primary/14 to-transparent shadow-glow ring-1 ring-knuckle-primary/30"
                : "border-white/[0.08] glass"
            }`}
          >
            {t.badge ? (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.2em] font-bold text-white bg-gradient-to-r from-knuckle-primary to-sky-400 px-3 py-1 rounded-full shadow-glow">
                {t.badge}
              </span>
            ) : null}
            <div>
              <p className="text-sm font-bold text-sky-100/95 font-display">{t.name}</p>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white font-display tabular-nums">{t.price}</span>
                <span className="text-slate-500 text-sm">{t.period}</span>
              </p>
              <p className="text-sm text-slate-400 mt-2">{t.headline}</p>
              <p className="text-xs text-slate-500 mt-5 leading-relaxed border-t border-white/[0.08] pt-5">{t.limit}</p>
            </div>
            <ul className="text-sm text-slate-300 space-y-2.5 flex-1 mt-6">
              {t.limits.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="text-knuckle-accent mt-0.5 font-bold">✓</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={
                Boolean(loading) ||
                caps.isLoading ||
                (caps.data != null && !caps.data.subscriptionCheckout)
              }
              title={
                caps.data && !caps.data.subscriptionCheckout
                  ? "Checkout is not enabled on this deployment (Stripe or price IDs missing on the API)."
                  : undefined
              }
              onClick={() => checkout(t.slug)}
              className={`mt-8 w-full rounded-full py-3.5 font-bold text-sm transition-all disabled:opacity-50 ${
                t.highlighted
                  ? "bg-gradient-to-r from-knuckle-primary to-sky-400 text-white shadow-glow hover:brightness-105"
                  : "border border-white/20 text-white hover:bg-white/[0.06]"
              }`}
            >
              {loading === t.slug
                ? "Redirecting…"
                : caps.data && !caps.data.subscriptionCheckout
                  ? "Checkout unavailable"
                  : `Choose ${t.name}`}
            </button>
          </div>
        ))}
      </div>

      <section className="glass rounded-[1.75rem] border border-white/[0.08] overflow-hidden">
        <div className="p-6 md:p-8 border-b border-white/[0.07]">
          <h2 className="text-xl font-bold text-white font-display">Compare at a glance</h2>
          <p className="text-sm text-slate-500 mt-2">
            Exact limits follow your live plan rows in Account after purchase. Digest email sends only when the API has mail
            credentials configured.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[640px]">
            <thead>
              <tr className="border-b border-white/[0.08] text-slate-500">
                <th className="p-4 font-semibold">Capability</th>
                <th className="p-4 font-semibold text-sky-200/90">Starter</th>
                <th className="p-4 font-semibold text-knuckle-primary">Pro</th>
                <th className="p-4 font-semibold text-sky-200/80">Ultimate</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.feature} className="border-b border-white/[0.05] text-slate-300">
                  <td className="p-4 text-slate-500">{row.feature}</td>
                  <td className="p-4">{row.starter}</td>
                  <td className="p-4 bg-knuckle-primary/[0.06]">{row.pro}</td>
                  <td className="p-4">{row.ultimate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="max-w-3xl">
        <h2 className="text-xl font-bold text-white font-display">FAQ</h2>
        <dl className="mt-8 space-y-8">
          {faq.map((item) => (
            <div key={item.q}>
              <dt className="font-semibold text-slate-200">{item.q}</dt>
              <dd className="text-sm text-slate-500 mt-2 leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 text-center text-sm text-slate-500">
        Educational and analytical use only. No outcome guarantees. Ensure compliance with regulations in your
        jurisdiction.
      </div>
    </div>
  );
}

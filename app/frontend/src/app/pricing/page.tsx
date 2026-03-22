"use client";

import { useState } from "react";
import Link from "next/link";
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
      "Morning digest (08:10 UTC hook)",
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
  { feature: "Morning digest", starter: "—", pro: "✓", ultimate: "✓" },
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
    a: "Create an account to explore the grid; premium depth is gated by plan. Contact sales for pilot programs.",
  },
];

export default function PricingPage() {
  const token = useAuthStore((s) => s.token);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function checkout(slug: (typeof tiers)[number]["slug"]) {
    setError(null);
    if (!token) {
      setError("Sign in from Account to subscribe securely.");
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
    <div className="space-y-14 pb-8">
      <div className="max-w-3xl">
        <p className="page-eyebrow">Pricing</p>
        <h1 className="page-title mt-3">Invest in depth that compounds</h1>
        <p className="text-slate-400 mt-4 text-lg leading-relaxed">
          Choose the cadence that matches how often you open full match intelligence — not generic “tips,” but
          auditable probabilities and risk-aware workflows.
        </p>
        {!token ? (
          <p className="mt-6 text-sm text-slate-400">
            Already decided?{" "}
            <Link href="/account" className="text-cyan-300 font-medium hover:text-cyan-200">
              Sign in
            </Link>{" "}
            first — checkout attaches to your account.
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
          <span className="text-slate-400">Checkout via Stripe</span>
          <span>Upgrade or cancel in the customer portal</span>
          <span>Invoices &amp; receipts in your email</span>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid md:grid-cols-3 gap-5 items-stretch">
        {tiers.map((t) => (
          <div
            key={t.slug}
            className={`relative flex flex-col rounded-3xl p-7 border transition-all ${
              t.highlighted
                ? "border-cyan-400/40 bg-gradient-to-b from-cyan-500/10 to-transparent shadow-glow ring-1 ring-cyan-400/20"
                : "border-white/10 glass"
            }`}
          >
            {t.badge ? (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest font-bold text-slate-950 bg-gradient-to-r from-cyan-300 to-violet-300 px-3 py-1 rounded-full">
                {t.badge}
              </span>
            ) : null}
            <div>
              <p className="text-sm font-medium text-cyan-200/90">{t.name}</p>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">{t.price}</span>
                <span className="text-slate-500 text-sm">{t.period}</span>
              </p>
              <p className="text-sm text-slate-400 mt-2">{t.headline}</p>
              <p className="text-xs text-slate-500 mt-4 leading-relaxed border-t border-white/10 pt-4">{t.limit}</p>
            </div>
            <ul className="text-sm text-slate-300 space-y-2.5 flex-1 mt-6">
              {t.limits.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="text-emerald-400/90 mt-0.5">✓</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={Boolean(loading)}
              onClick={() => checkout(t.slug)}
              className={`mt-8 w-full rounded-full py-3 font-semibold text-sm transition-opacity disabled:opacity-50 ${
                t.highlighted
                  ? "bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950"
                  : "border border-white/20 text-white hover:bg-white/5"
              }`}
            >
              {loading === t.slug ? "Redirecting…" : `Choose ${t.name}`}
            </button>
          </div>
        ))}
      </div>

      <section className="glass rounded-3xl border border-white/10 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Compare at a glance</h2>
          <p className="text-sm text-slate-500 mt-1">Exact limits follow your live plan rows in Account after purchase.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[640px]">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="p-4 font-medium">Capability</th>
                <th className="p-4 font-medium text-cyan-200/90">Starter</th>
                <th className="p-4 font-medium text-cyan-200">Pro</th>
                <th className="p-4 font-medium text-violet-200/90">Ultimate</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.feature} className="border-b border-white/5 text-slate-300">
                  <td className="p-4 text-slate-400">{row.feature}</td>
                  <td className="p-4">{row.starter}</td>
                  <td className="p-4 bg-cyan-500/5">{row.pro}</td>
                  <td className="p-4">{row.ultimate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="max-w-3xl">
        <h2 className="text-xl font-semibold text-white">FAQ</h2>
        <dl className="mt-6 space-y-6">
          {faq.map((item) => (
            <div key={item.q}>
              <dt className="font-medium text-slate-200">{item.q}</dt>
              <dd className="text-sm text-slate-500 mt-2 leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-500">
        Educational and analytical use only. No outcome guarantees. Ensure compliance with regulations in your
        jurisdiction.
      </div>
    </div>
  );
}

import Link from "next/link";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/constants";

const howSteps = [
  {
    step: "01",
    title: "Ingest & calibrate",
    body: "Odds are de-vigged and blended with a Poisson/Dixon–Coles score lattice — the same distribution drives 1X2, exact score, and BTTS/O-U context.",
  },
  {
    step: "02",
    title: "Trust & risk first",
    body: "Every fixture gets a trust index, volatility read, and explicit NO BET when signals disagree or data is thin — not a confidence theater.",
  },
  {
    step: "03",
    title: "Build habits",
    body: "Watchlists for monitoring, vault snapshots for review, Pro digests for morning sweeps — designed for repeat use, not one-off clicks.",
  },
];

const proofRow = [
  { label: "Model versioning", value: "Shipped per prediction" },
  { label: "Methodology", value: "Transparent bullets" },
  { label: "Market context", value: "Calibration layer" },
  { label: "Governance", value: "NO BET + trap flags" },
];

const faq = [
  {
    q: "Is this a tipping service?",
    a: "No. Oracle Pitch outputs probabilities, bands, and risk flags for analysis. How you use that information is your responsibility.",
  },
  {
    q: "Why pay for Starter vs Pro?",
    a: "Starter covers daily premium breakdowns with core rails. Pro adds deeper similarity cohort stats, scenarios, and morning digest automation.",
  },
  {
    q: "Do you guarantee results?",
    a: "No credible model does. We expose uncertainty and shrink extreme outputs toward market prices when epistemic confidence is low.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-16 md:space-y-24 pb-8">
      <section className="glass-strong rounded-[2rem] p-8 md:p-14 border border-white/10 relative overflow-hidden">
        <div className="absolute inset-y-0 right-0 w-2/3 md:w-1/2 bg-gradient-to-l from-cyan-500/15 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative space-y-8 max-w-3xl">
          <p className="page-eyebrow">Football intelligence platform</p>
          <h1 className="text-4xl md:text-6xl font-semibold leading-[1.08] text-white">
            <span className="text-gradient">{PRODUCT_NAME}</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 font-medium leading-snug">{PRODUCT_TAGLINE}</p>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-2xl">
            The control room for pricing-aware forecasts: calibrated probabilities, historical market-structure cohorts,
            trust indexing, and vault-grade workflows — built for analysts who care about process, not slogans.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/dashboard" className="btn-primary">
              Open intelligence grid
            </Link>
            <Link href="/pricing" className="btn-secondary">
              View plans
            </Link>
            <Link href="/insights" className="btn-secondary hidden sm:inline-flex">
              Trust center
            </Link>
          </div>
          <p className="text-[11px] text-slate-500 uppercase tracking-[0.2em] pt-2">
            Built for analysts who need auditability
          </p>
          <div className="flex flex-wrap gap-2 pt-4">
            {proofRow.map((p) => (
              <span
                key={p.label}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-400"
              >
                <span className="text-cyan-300/90 font-medium">{p.value}</span>
                <span className="text-slate-600">·</span>
                <span>{p.label}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-5">
        {[
          {
            title: "Transparent by design",
            body: "Every ticket carries model version, methodology lines, raw vs calibrated probabilities, and goals bands — audit-friendly, not black-box.",
          },
          {
            title: "Retention built in",
            body: "Watchlists, immutable vault snapshots, optional digests, and engagement-aware metering that scales with your plan.",
          },
          {
            title: "Production-ready stack",
            body: "Fast API, caching, scheduled refresh, Stripe billing, and admin controls — so you can ship, not just demo.",
          },
        ].map((c) => (
          <div key={c.title} className="card-premium p-6 md:p-7 space-y-3">
            <h3 className="font-semibold text-white text-lg">{c.title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{c.body}</p>
          </div>
        ))}
      </section>

      <section className="glass rounded-3xl p-8 md:p-12 border border-white/10">
        <p className="page-eyebrow">How it works</p>
        <h2 className="page-title mt-3">From prices to decisions — without the hand-waving</h2>
        <p className="page-lead mt-3 text-base">
          Three layers you can explain to a client or compliance officer: data → model → governance.
        </p>
        <div className="mt-10 grid md:grid-cols-3 gap-8">
          {howSteps.map((s) => (
            <div key={s.step} className="relative pl-4 border-l border-cyan-500/30">
              <p className="text-xs font-mono text-cyan-300/80 mb-2">{s.step}</p>
              <h3 className="font-semibold text-white text-lg">{s.title}</h3>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-8 md:p-12">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h2 className="page-title">Plans that match how deeply you work</h2>
            <p className="page-lead mt-3">
              From daily premium breakdowns to unlimited depth and digest automation — upgrade when the product
              becomes part of your routine.
            </p>
          </div>
          <Link href="/pricing" className="btn-primary shrink-0 self-start md:self-auto">
            Compare plans
          </Link>
        </div>
        <div className="mt-10 grid sm:grid-cols-3 gap-4 text-sm">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <p className="text-slate-500 text-xs uppercase tracking-wider">Starter</p>
            <p className="text-white font-semibold mt-2">Core rails</p>
            <p className="text-slate-400 mt-2">Daily premium views, confidence + risk, email support.</p>
          </div>
          <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/5 p-5 ring-1 ring-cyan-400/20">
            <p className="text-cyan-300/90 text-xs uppercase tracking-wider">Pro · Best value</p>
            <p className="text-white font-semibold mt-2">Serious desk</p>
            <p className="text-slate-400 mt-2">More daily views, similarity cohorts, scenarios, digest.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <p className="text-slate-500 text-xs uppercase tracking-wider">Ultimate</p>
            <p className="text-white font-semibold mt-2">No limits</p>
            <p className="text-slate-400 mt-2">Unlimited breakdowns, API-grade outputs, priority.</p>
          </div>
        </div>
      </section>

      <section className="max-w-3xl">
        <h2 className="page-title">Questions</h2>
        <p className="text-slate-500 text-sm mt-2">Straight answers — no hype.</p>
        <dl className="mt-8 space-y-6">
          {faq.map((item) => (
            <div key={item.q} className="border-b border-white/10 pb-6">
              <dt className="font-semibold text-white">{item.q}</dt>
              <dd className="text-sm text-slate-400 mt-2 leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="glass-strong rounded-3xl p-8 md:p-10 border border-white/10 text-center">
        <h2 className="text-2xl md:text-3xl font-semibold text-white">Ready to run a serious desk?</h2>
        <p className="text-slate-400 mt-3 max-w-xl mx-auto text-sm">
          Start on the intelligence grid. Sign in to sync watchlists and vault — upgrade when you need more depth.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="btn-primary">
            Launch grid
          </Link>
          <Link href="/account" className="btn-secondary">
            Create account
          </Link>
        </div>
      </section>
    </div>
  );
}

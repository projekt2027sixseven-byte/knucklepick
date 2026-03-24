import Link from "next/link";
import { HomeDreamHero } from "@/components/HomeDreamHero";

const howSteps = [
  {
    step: "01",
    title: "Ingest & calibrate",
    body: "Odds are de-vigged and blended with a Poisson / Dixon–Coles lattice — one soft distribution for 1X2, exact score, and BTTS context.",
  },
  {
    step: "02",
    title: "Trust & risk first",
    body: "Every fixture gets a trust read and explicit NO BET when signals disagree — not confidence cosplay.",
  },
  {
    step: "03",
    title: "Build habits",
    body: "Watchlists, vault snapshots, optional digests — built for repeat drift, not one-off clicks.",
  },
];

const proofRow = [
  { label: "Model versioning", value: "Shipped per prediction" },
  { label: "Methodology", value: "Transparent bullets" },
  { label: "Market context", value: "Calibration layer" },
  { label: "Governance", value: "NO BET + trap flags" },
];

const featureCards = [
  {
    k: "01",
    title: "Transparent by design",
    body: "Every ticket carries model version, methodology lines, and goals bands — weird interface, serious audit trail.",
  },
  {
    k: "02",
    title: "Retention built in",
    body: "Watchlists, vault snapshots, digests — metering that scales with your plan without killing the vibe.",
  },
  {
    k: "03",
    title: "Production stack",
    body: "Fast API, caching, Stripe, admin controls — built for real sessions and repeat workflows.",
  },
];

const terminalPreview = `> ingest.status     OK  (fixtures 48h · live)
> calibration       applied  (λ shrink → market)
> top_pick.conf     0.61  ·  trust 0.74  ·  NO_BET false`;

const faq = [
  {
    q: "Is this a tipping service?",
    a: "No. Knuckle outputs probabilities, bands, and risk flags for analysis. How you use that information is your responsibility.",
  },
  {
    q: "Why pay for Starter vs Pro?",
    a: "Starter covers daily premium breakdowns with core rails. Pro adds deeper similarity cohort stats, scenarios, and digest email when the server has mail credentials configured.",
  },
  {
    q: "Do you guarantee results?",
    a: "No credible model does. We expose uncertainty and shrink extreme outputs toward market prices when confidence is low.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-24 pb-16 md:space-y-32 md:pb-24">
      <HomeDreamHero />

      <section className="relative -mt-8 md:-mt-12">
        <div className="dream-panel relative overflow-hidden rounded-[1.75rem] p-5 md:p-7">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 via-transparent to-cyan-500/10" />
          <div className="relative flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.6)]" aria-hidden />
            <span>Desk preview (illustrative)</span>
          </div>
          <pre className="relative mt-4 font-mono text-[11px] leading-relaxed text-slate-300 md:text-xs whitespace-pre-wrap">
            {terminalPreview}
          </pre>
        </div>
      </section>

      <section className="relative">
        <div className="pointer-events-none absolute -left-8 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="grid gap-5 md:grid-cols-3 md:gap-6">
          {featureCards.map((c, i) => (
            <div
              key={c.k}
              className={`dream-panel group p-7 transition-all duration-500 md:p-8 ${
                i === 1 ? "md:-translate-y-3 md:rotate-1" : i === 2 ? "md:translate-y-4 md:-rotate-1" : ""
              } motion-reduce:translate-y-0 motion-reduce:rotate-0`}
            >
              <p className="font-mono text-[11px] font-bold tracking-widest text-fuchsia-300/90">{c.k}</p>
              <h3 className="mt-3 font-display text-lg font-bold text-white">{c.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative overflow-visible">
        <div className="glass-strong relative rounded-[2rem] border border-fuchsia-500/20 p-8 md:p-12">
          <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-gradient-to-bl from-violet-500/20 to-transparent blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="page-eyebrow">How it works</p>
            <h2 className="page-title mt-4 max-w-2xl md:text-5xl">From market prices to a clear take</h2>
            <p className="page-lead mt-4 text-base">
              Data ingest, calibrated model output, then governance (NO BET, traps, weak signals) so you know when not to
              trust the headline number.
            </p>
          </div>
          <div className="relative mt-14 flex flex-col gap-12 md:gap-16">
            {howSteps.map((s, i) => (
              <div
                key={s.step}
                className={`relative max-w-xl pl-6 md:pl-8 ${
                  i % 2 === 1 ? "md:ml-auto md:max-w-lg md:text-right md:pl-0 md:pr-8" : ""
                }`}
              >
                <div
                  className={`absolute top-0 h-full w-px bg-gradient-to-b from-fuchsia-400/50 via-violet-400/30 to-transparent ${
                    i % 2 === 1 ? "right-0 md:right-auto md:left-full" : "left-0"
                  }`}
                />
                <p className="font-mono text-xs font-semibold text-fuchsia-300/95">{s.step}</p>
                <h3 className="mt-2 font-display text-xl font-bold text-white">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          {proofRow.map((p) => (
            <span
              key={p.label}
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[11px] text-slate-400"
            >
              <span className="font-semibold text-fuchsia-300">{p.value}</span>
              <span className="text-slate-600">·</span>
              <span>{p.label}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="relative rounded-[2rem] border border-white/[0.1] bg-gradient-to-br from-fuchsia-600/[0.12] via-transparent to-orange-500/[0.08] p-8 md:p-12">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.06)_0,rgba(255,255,255,0.06)_1px,transparent_1px,transparent_40px)]" />
        <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <h2 className="page-title md:text-4xl">Plans when you want more depth</h2>
            <p className="page-lead mt-4">
              Free exploration on the deck; paid tiers add more premium match views and extras. Checkout only appears when
              billing is enabled on the server.
            </p>
          </div>
          <Link href="/pricing" className="btn-primary shrink-0 self-start md:self-auto">
            Compare plans
          </Link>
        </div>
        <div className="relative mt-12 grid gap-4 text-sm sm:grid-cols-3">
          <div className="dream-panel rounded-2xl p-6 backdrop-blur-md">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Starter</p>
            <p className="mt-3 font-display text-lg font-bold text-white">Core rails</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">Daily premium views, confidence + risk, email support.</p>
          </div>
          <div className="rounded-2xl border border-fuchsia-400/40 bg-gradient-to-b from-fuchsia-500/20 to-purple-950/40 p-6 shadow-[0_0_40px_rgba(232,121,249,0.25)] ring-1 ring-fuchsia-400/30">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-100">Pro · Best value</p>
            <p className="mt-3 font-display text-lg font-bold text-white">Serious desk</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">More daily views, similarity cohorts, scenarios, digest.</p>
          </div>
          <div className="dream-panel rounded-2xl p-6 backdrop-blur-md">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Ultimate</p>
            <p className="mt-3 font-display text-lg font-bold text-white">No limits</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">Unlimited breakdowns, API-grade outputs, priority.</p>
          </div>
        </div>
      </section>

      <section className="max-w-3xl">
        <div className="glass-strong relative overflow-hidden rounded-[2rem] border border-fuchsia-500/15 p-8 md:p-10">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="relative">
            <h2 className="page-title">Questions</h2>
            <p className="mt-3 text-sm font-medium text-slate-500">Straight answers — no vaporwave promises.</p>
            <dl className="mt-10 space-y-8">
              {faq.map((item) => (
                <div key={item.q} className="border-b border-white/[0.08] pb-8 last:border-0 last:pb-0">
                  <dt className="font-display font-bold text-white">{item.q}</dt>
                  <dd className="mt-3 text-sm leading-relaxed text-slate-400">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="glass-strong relative overflow-hidden rounded-[2rem] border border-cyan-400/25 p-8 text-center md:p-12">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-fuchsia-600/10 to-transparent" />
        <div className="relative">
          <h2 className="font-display text-2xl font-bold text-white md:text-3xl">Ready to haunt your own desk?</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
            Float into the Deck. Sign in to sync watchlists and vault — upgrade when you need more depth.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard" className="btn-primary">
              Launch Deck
            </Link>
            <Link href="/account" className="btn-secondary">
              Create account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

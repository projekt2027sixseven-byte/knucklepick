import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/constants";
import { getSupportEmail } from "@/lib/support";

export function SiteFooter() {
  const support = getSupportEmail();

  return (
    <footer className="mt-auto border-t border-white/[0.08] bg-dream-ink/50 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
        <div className="grid gap-8 md:grid-cols-4 md:gap-10">
          <div className="md:col-span-1">
            <p className="font-display text-xs font-bold uppercase tracking-[0.28em] text-fuchsia-300/75">{PRODUCT_NAME}</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Football match intelligence: probabilities, risk flags, and a decision deck — for analysis, not tips.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Product</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/dashboard" className="text-slate-400 transition-colors hover:text-fuchsia-300">
                  Intelligence deck
                </Link>
              </li>
              <li>
                <Link href="/insights" className="text-slate-400 transition-colors hover:text-fuchsia-300">
                  Signal center
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-slate-400 transition-colors hover:text-fuchsia-300">
                  Plans &amp; billing
                </Link>
              </li>
              <li>
                <Link href="/account" className="text-slate-400 transition-colors hover:text-fuchsia-300">
                  Account
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Legal</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="text-slate-400 transition-colors hover:text-fuchsia-300">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-slate-400 transition-colors hover:text-fuchsia-300">
                  Terms of use
                </Link>
              </li>
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-slate-600">
              Analytical use only. No outcome guarantees. Comply with applicable laws in your jurisdiction.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Support</p>
            {support ? (
              <p className="mt-3 text-sm text-slate-400">
                <a
                  href={`mailto:${support}`}
                  className="font-medium text-fuchsia-300/90 transition-colors hover:text-fuchsia-200"
                >
                  {support}
                </a>
              </p>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                For this release, reach the operator directly. To show a mail link here, set{" "}
                <span className="font-mono text-[11px] text-slate-500">NEXT_PUBLIC_SUPPORT_EMAIL</span> in Vercel.
              </p>
            )}
          </div>
        </div>
        <p className="mt-10 border-t border-white/[0.06] pt-6 text-center text-[11px] text-slate-600">
          © {new Date().getFullYear()} {PRODUCT_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

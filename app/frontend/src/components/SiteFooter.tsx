import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/constants";
import { getSupportEmail } from "@/lib/support";

export function SiteFooter() {
  const support = getSupportEmail();

  return (
    <footer className="mt-auto border-t border-white/10 bg-black/25 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
        <div className="grid gap-8 md:grid-cols-4 md:gap-10">
          <div className="md:col-span-1">
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300/70">{PRODUCT_NAME}</p>
            <p className="text-sm text-slate-400 mt-3 leading-relaxed">
              Premium probability intelligence for serious desks — process, calibration, and governance, not hype.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Product</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/dashboard" className="text-slate-400 hover:text-cyan-200 transition-colors">
                  Intelligence grid
                </Link>
              </li>
              <li>
                <Link href="/insights" className="text-slate-400 hover:text-cyan-200 transition-colors">
                  Trust center
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-slate-400 hover:text-cyan-200 transition-colors">
                  Plans &amp; billing
                </Link>
              </li>
              <li>
                <Link href="/account" className="text-slate-400 hover:text-cyan-200 transition-colors">
                  Account
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Legal</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="text-slate-400 hover:text-cyan-200 transition-colors">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-slate-400 hover:text-cyan-200 transition-colors">
                  Terms of use
                </Link>
              </li>
            </ul>
            <p className="text-xs text-slate-500 mt-4 leading-relaxed">
              Analytical use only. No outcome guarantees. Comply with applicable laws in your jurisdiction.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Support</p>
            {support ? (
              <p className="text-sm text-slate-400 mt-3">
                <a href={`mailto:${support}`} className="text-cyan-300/90 hover:text-cyan-200 font-medium">
                  {support}
                </a>
              </p>
            ) : (
              <p className="text-sm text-slate-500 mt-3 leading-relaxed">
                Set <span className="font-mono text-[11px] text-slate-400">NEXT_PUBLIC_SUPPORT_EMAIL</span> on your
                deployment for a public inbox link.
              </p>
            )}
          </div>
        </div>
        <p className="text-center text-[11px] text-slate-600 mt-10 pt-6 border-t border-white/5">
          © {new Date().getFullYear()} {PRODUCT_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/constants";

export default function NotFound() {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center px-4 py-12">
      <div className="glass-strong w-full max-w-md rounded-[1.75rem] border border-white/[0.09] p-10 md:p-12 text-center relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-fuchsia-600/15 to-transparent" />
        <div className="relative">
          <p className="font-display text-xs font-bold uppercase tracking-[0.35em] text-fuchsia-300/90">404</p>
          <h1 className="mt-4 text-2xl md:text-3xl font-bold text-white tracking-tight font-display">Page not found</h1>
          <p className="mt-3 text-sm text-slate-400 leading-relaxed">
            That path isn’t wired in {PRODUCT_NAME}. Return home or open the Deck to continue.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn-primary text-sm py-2.5 px-6">
              Home
            </Link>
            <Link href="/dashboard" className="btn-secondary text-sm py-2.5 px-6">
              Open Deck
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="glass-strong max-w-md w-full rounded-[1.75rem] border border-white/[0.08] p-8 md:p-10 space-y-5">
        <p className="text-[10px] uppercase tracking-[0.35em] text-rose-300/90 font-bold font-display">Error</p>
        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight font-display">Something went wrong</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          This view hit an unexpected problem. Try again — if it persists, return home and open the Deck from there.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button type="button" onClick={() => reset()} className="btn-primary px-6 py-2.5 text-sm">
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-full border border-fuchsia-500/30 px-6 py-2.5 text-sm font-semibold text-fuchsia-100 hover:bg-fuchsia-500/15 transition-colors"
          >
            Open deck
          </Link>
          <Link
            href="/"
            className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.06] transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

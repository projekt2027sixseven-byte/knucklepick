import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/constants";

export default function NotFound() {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center text-center px-4">
      <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">404</p>
      <h1 className="mt-4 text-2xl md:text-3xl font-semibold text-white tracking-tight">Page not found</h1>
      <p className="mt-3 text-sm text-slate-400 max-w-md leading-relaxed">
        That URL isn’t part of {PRODUCT_NAME}. Head back to the desk or open the intelligence grid.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary text-sm py-2.5 px-6">
          Home
        </Link>
        <Link href="/dashboard" className="btn-secondary text-sm py-2.5 px-6">
          Intelligence grid
        </Link>
      </div>
    </div>
  );
}

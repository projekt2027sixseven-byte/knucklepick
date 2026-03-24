"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/constants";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { DreamBackground } from "@/components/DreamBackground";
import { DataTrustBanner } from "@/components/DataTrustBanner";
import { apiFetch } from "@/lib/api";
import type { DataContextPublic } from "@/lib/dataContext";

const nav = [
  { href: "/", label: "Overview" },
  { href: "/dashboard", label: "Deck" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/picks", label: "Vault" },
  { href: "/insights", label: "Signal" },
  { href: "/pricing", label: "Plans" },
  { href: "/account", label: "Account" },
  { href: "/admin", label: "Admin", role: "ADMIN" as const },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const dataCtx = useQuery({
    queryKey: ["meta-data-context"],
    queryFn: () => apiFetch<DataContextPublic>("/api/meta/data-context"),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  return (
    <div className="relative min-h-screen">
      <DreamBackground />
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[17.5rem] flex-col gap-8 border-r border-white/[0.08] bg-dream-ink/40 px-4 py-8 backdrop-blur-xl lg:flex">
            <Link href="/" className="group px-2">
              <p className="font-display text-[10px] font-semibold uppercase tracking-[0.42em] text-fuchsia-300/80">
                Navigate
              </p>
              <p className="mt-2 font-display text-xl font-bold leading-tight tracking-tight text-white transition-colors duration-300 group-hover:text-fuchsia-200">
                {PRODUCT_NAME}
              </p>
              <p className="mt-2 text-[12px] leading-snug text-slate-500">{PRODUCT_TAGLINE}</p>
            </Link>
            <nav className="flex flex-col gap-1 text-[13px] font-medium" aria-label="Main">
              {nav
                .filter((item) => !item.role || user?.role === item.role)
                .map((item) => {
                  const active =
                    pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-2xl px-3 py-2.5 transition-all duration-300 ${
                        active
                          ? "border border-fuchsia-500/35 bg-gradient-to-r from-fuchsia-500/20 to-purple-900/20 text-white shadow-[0_0_28px_rgba(167,139,250,0.25)]"
                          : "text-slate-500 hover:bg-white/[0.05] hover:text-fuchsia-100"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
            </nav>
            <div className="dream-panel mt-auto rounded-2xl p-4 text-xs leading-relaxed text-slate-400">
              {user ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Signed in</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-fuchsia-100/90">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="text-xs font-semibold text-rose-300/90 transition-colors hover:text-rose-200"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-slate-300">Unlock watchlists, vault saves, and full breakdowns.</p>
                  <Link
                    href="/account"
                    className="mt-3 inline-block font-semibold text-fuchsia-300 transition-colors hover:text-fuchsia-200"
                  >
                    Sign in →
                  </Link>
                </>
              )}
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.08] bg-dream-ink/55 px-4 py-3.5 backdrop-blur-xl lg:hidden">
              <Link href="/" className="font-display text-lg font-bold tracking-tight text-white">
                {PRODUCT_NAME}
              </Link>
              <div className="flex items-center gap-3">
                <Link href="/pricing" className="text-xs font-semibold text-fuchsia-300/95">
                  Plans
                </Link>
                <Link href="/account" className="text-sm font-semibold text-fuchsia-300">
                  {user ? "Account" : "Sign in"}
                </Link>
              </div>
            </header>
            <div className="noise flex min-w-0 flex-1 flex-col">
              <main
                id="main-content"
                className="main-pad-mobile mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none lg:py-12"
                tabIndex={-1}
              >
                {dataCtx.data ? <DataTrustBanner context={dataCtx.data} /> : null}
                {dataCtx.isError ? (
                  <div
                    className="mb-6 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-[11px] text-slate-500"
                    role="status"
                  >
                    Couldn&apos;t verify data-feed configuration.{" "}
                    <button
                      type="button"
                      className="font-semibold text-fuchsia-300 hover:text-fuchsia-200"
                      onClick={() => void dataCtx.refetch()}
                    >
                      Retry
                    </button>
                  </div>
                ) : null}
                {children}
              </main>
              <SiteFooter />
            </div>
          </div>
        </div>
        <MobileNav />
      </div>
    </div>
  );
}

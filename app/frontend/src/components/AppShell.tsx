"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { PRODUCT_NAME } from "@/lib/constants";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";

const nav = [
  { href: "/", label: "Overview" },
  { href: "/dashboard", label: "Intelligence" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/picks", label: "Vault" },
  { href: "/insights", label: "Trust" },
  { href: "/pricing", label: "Plans" },
  { href: "/account", label: "Account" },
  { href: "/admin", label: "Admin", role: "ADMIN" as const },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:flex w-64 flex-col border-r border-white/10 bg-black/35 backdrop-blur-xl px-4 py-7 gap-8">
          <Link href="/" className="px-2 group">
            <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-300/75">Control room</p>
            <p className="text-lg font-semibold text-white leading-tight mt-1 group-hover:text-cyan-100 transition-colors">
              {PRODUCT_NAME}
            </p>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">Signal over noise. Decisions over hype.</p>
          </Link>
          <nav className="flex flex-col gap-0.5 text-sm" aria-label="Main">
            {nav
              .filter((item) => !item.role || user?.role === item.role)
              .map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl px-3 py-2.5 transition-all ${
                      active
                        ? "bg-white/[0.12] text-white shadow-sm shadow-black/20"
                        : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
          </nav>
          <div className="mt-auto glass rounded-2xl p-4 text-xs text-slate-400 leading-relaxed">
            {user ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Signed in</p>
                  <p className="text-slate-200 font-medium truncate text-sm mt-0.5">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="text-rose-300/90 hover:text-rose-200 text-xs font-medium"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <>
                <p className="text-slate-300">Unlock watchlists, vault saves, and full match breakdowns.</p>
                <Link href="/account" className="inline-block mt-3 text-cyan-300 hover:text-cyan-200 font-medium">
                  Sign in →
                </Link>
              </>
            )}
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="lg:hidden sticky top-0 z-30 border-b border-white/10 bg-black/50 backdrop-blur-md px-4 py-3.5 flex items-center justify-between">
            <Link href="/" className="font-semibold text-white tracking-tight">
              {PRODUCT_NAME}
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/pricing" className="text-xs font-medium text-cyan-300/90">
                Plans
              </Link>
              <Link href="/account" className="text-sm text-cyan-300 font-medium">
                {user ? "Account" : "Sign in"}
              </Link>
            </div>
          </header>
          <div className="flex-1 noise flex flex-col min-h-0">
            <main
              id="main-content"
              className="mx-auto max-w-6xl px-4 py-8 lg:py-10 flex-1 w-full main-pad-mobile outline-none"
              tabIndex={-1}
            >
              {children}
            </main>
            <SiteFooter />
          </div>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", short: "Home" },
  { href: "/dashboard", label: "Deck", short: "Deck" },
  { href: "/watchlist", label: "Watch", short: "Watch" },
  { href: "/picks", label: "Vault", short: "Vault" },
  { href: "/insights", label: "Signal", short: "Signal" },
  { href: "/account", label: "You", short: "You" },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-fuchsia-500/20 bg-dream-ink/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgba(88,28,135,0.35)] backdrop-blur-2xl lg:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 py-2">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[48px] flex-1 flex-col items-center justify-center rounded-2xl py-2 text-[11px] font-semibold transition-all duration-300 ${
                active
                  ? "border border-fuchsia-400/40 bg-gradient-to-b from-fuchsia-500/25 to-purple-900/30 text-white shadow-[0_0_24px_rgba(232,121,249,0.35)]"
                  : "text-slate-500 hover:text-fuchsia-200"
              }`}
            >
              <span>{item.short}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

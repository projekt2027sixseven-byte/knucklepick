"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", short: "Home" },
  { href: "/dashboard", label: "Intel", short: "Grid" },
  { href: "/watchlist", label: "Watch", short: "Watch" },
  { href: "/picks", label: "Vault", short: "Vault" },
  { href: "/account", label: "You", short: "You" },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-black/70 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <div className="flex justify-around items-stretch max-w-lg mx-auto px-1 py-2">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl text-[11px] font-medium transition-colors min-h-[48px] ${
                active ? "text-cyan-200 bg-white/10 shadow-sm shadow-black/20" : "text-slate-500 hover:text-slate-200"
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

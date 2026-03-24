import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  title: string;
  description: ReactNode;
  icon?: ReactNode;
  action?: { label: string; href: string };
  secondary?: { label: string; href: string };
  /** Inline retry (e.g. React Query refetch) without full page navigation. */
  retry?: () => void;
};

export function EmptyState({ title, description, icon, action, secondary, retry }: Props) {
  return (
    <div className="glass-strong mx-auto max-w-lg rounded-2xl border border-fuchsia-500/15 p-8 text-center shadow-lift md:p-10">
      {icon ? <div className="mb-4 flex justify-center text-fuchsia-300">{icon}</div> : null}
      <h3 className="font-display text-lg font-bold text-white">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-slate-400">{description}</div>
      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        {retry ? (
          <button
            type="button"
            onClick={retry}
            className="btn-primary inline-flex justify-center px-6 py-2.5 text-sm"
          >
            Try again
          </button>
        ) : null}
        {action ? (
          <Link href={action.href} className="btn-primary inline-flex justify-center px-6 py-2.5 text-sm">
            {action.label}
          </Link>
        ) : null}
        {secondary ? (
          <Link
            href={secondary.href}
            className="inline-flex justify-center rounded-full border border-white/15 px-6 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.06]"
          >
            {secondary.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

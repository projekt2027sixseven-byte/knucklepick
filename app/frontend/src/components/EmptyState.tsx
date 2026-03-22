import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: { label: string; href: string };
  secondary?: { label: string; href: string };
};

export function EmptyState({ title, description, icon, action, secondary }: Props) {
  return (
    <div className="glass rounded-2xl border border-white/10 p-8 md:p-10 text-center max-w-lg mx-auto">
      {icon ? <div className="mb-4 flex justify-center text-cyan-300/90">{icon}</div> : null}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm text-slate-400 mt-2 leading-relaxed">{description}</p>
      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
        {action ? (
          <Link
            href={action.href}
            className="inline-flex justify-center rounded-full bg-gradient-to-r from-cyan-400/90 to-violet-500/90 text-slate-950 font-semibold px-6 py-2.5 text-sm hover:opacity-95 transition-opacity"
          >
            {action.label}
          </Link>
        ) : null}
        {secondary ? (
          <Link
            href={secondary.href}
            className="inline-flex justify-center rounded-full border border-white/20 text-slate-200 font-medium px-6 py-2.5 text-sm hover:bg-white/5 transition-colors"
          >
            {secondary.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import type { DataContextPublic } from "@/lib/dataContext";

/**
 * Shown when the server is not on a full live data path (missing keys or demo mode).
 * Keeps expectations honest without blocking the app.
 */
export function DataTrustBanner({ context }: { context: DataContextPublic }) {
  if (context.liveIntegrations) return null;

  const lines: string[] = [];
  if (context.mockDataMode) {
    lines.push("Demo mode (MOCK_DATA_MODE) is on — schedules and prices may be synthetic.");
  }
  if (!context.footballApiConfigured) {
    lines.push("Football API key is not configured — fixture lists may fall back to generated data.");
  }
  if (!context.oddsApiConfigured) {
    lines.push("Odds API key is not configured — book prices are synthetic; edges are illustrative.");
  }
  if (lines.length === 0) {
    lines.push("Data feeds are not fully configured — treat outputs as exploratory until live keys are set.");
  }

  return (
    <div
      className="mb-6 rounded-2xl border border-amber-500/35 bg-amber-950/30 px-4 py-3 text-sm text-amber-100/95 shadow-[0_0_24px_rgba(245,158,11,0.08)]"
      role="status"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/90">Data source notice</p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-amber-50/90">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-amber-200/70">
        Saved picks and public track record exclude synthetic runs where labeled. Not financial advice.
      </p>
    </div>
  );
}

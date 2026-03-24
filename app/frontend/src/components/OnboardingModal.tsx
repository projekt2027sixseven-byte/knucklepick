"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

type Me = {
  preferences?: { onboardingCompletedAt?: string | null; onboardingStep?: number } | null;
};

const steps = [
  {
    title: "What you’re looking at",
    body: "Each fixture is a full probability object — not a tip. The model outputs distributions; confidence and trust scores describe how much to lean on them.",
  },
  {
    title: "How to use the deck",
    body: "Start on the Deck for trust-ranked picks. Open a match for calibrated 1X2, exact score mass, similarity cohorts, and explicit NO BET when governance triggers.",
  },
  {
    title: "Build a habit",
    body: "Pin matches to your watchlist, save vault snapshots for review, and upgrade when you want Pro+ digests (email sends when the API has mail configured) and deeper cohort stats.",
  },
];

export function OnboardingModal() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const me = useQuery({
    queryKey: ["me", token],
    enabled: Boolean(token),
    queryFn: () => apiFetch<Me>("/api/auth/me", { token }),
  });

  const complete = useCallback(
    async (goDashboard: boolean) => {
      if (!token) return;
      try {
        await apiFetch("/api/me/preferences", {
          method: "PUT",
          token,
          body: JSON.stringify({ onboardingCompleted: true }),
        });
        await qc.invalidateQueries({ queryKey: ["me"] });
      } catch {
        /* still close so the user isn’t blocked */
      }
      setOpen(false);
      if (goDashboard) router.push("/dashboard");
    },
    [token, qc, router]
  );

  const dismissLater = useCallback(async () => {
    await complete(false);
  }, [complete]);

  useEffect(() => {
    if (!token) {
      setOpen(false);
      return;
    }
    if (!me.isSuccess) return;
    setOpen(!me.data?.preferences?.onboardingCompletedAt);
  }, [me.data, me.isSuccess, token]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void dismissLater();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismissLater]);

  if (!open) return null;

  const s = steps[step]!;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md px-4 pb-[env(safe-area-inset-bottom)] sm:p-4"
      role="presentation"
      onClick={() => void dismissLater()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="glass-strong max-h-[90vh] w-full max-w-lg space-y-6 overflow-y-auto rounded-t-3xl border border-fuchsia-500/25 p-6 shadow-2xl shadow-black/60 sm:rounded-[1.75rem] sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-3">
          <div>
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.35em] text-fuchsia-300">First session</p>
            <h2 id="onboarding-title" className="text-xl sm:text-2xl font-bold text-white mt-2 leading-snug font-display">
              {s.title}
            </h2>
          </div>
          <span className="text-xs text-slate-500 tabular-nums shrink-0 font-mono">
            {step + 1}/{steps.length}
          </span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{s.body}</p>
        <div className="flex gap-2">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Step ${i + 1}`}
              onClick={() => setStep(i)}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i === step ? "bg-fuchsia-500 shadow-glow" : "bg-white/10"
              }`}
            />
          ))}
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-1">
          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((x) => x + 1)}
              className="btn-primary flex-1 min-w-[140px] py-3 text-sm"
            >
              Next
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void complete(true)}
                className="btn-primary flex-1 min-w-[140px] py-3 text-sm"
              >
                Enter the deck
              </button>
              <button
                type="button"
                onClick={() => void complete(false)}
                className="flex-1 min-w-[140px] rounded-full border border-white/20 py-3 text-sm font-semibold text-slate-200 hover:bg-white/[0.06] transition-colors"
              >
                Finish here
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => void dismissLater()}
            className="sm:px-4 py-3 text-sm text-slate-500 hover:text-white transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

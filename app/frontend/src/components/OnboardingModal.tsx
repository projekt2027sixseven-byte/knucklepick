"use client";

import { useEffect, useState } from "react";
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
    title: "How to use the desk",
    body: "Start on the Intelligence grid for trust-ranked picks. Open a match for calibrated 1X2, exact score mass, similarity cohorts, and explicit NO BET when governance triggers.",
  },
  {
    title: "Build a habit",
    body: "Pin matches to your watchlist, save vault snapshots for review, and upgrade when you want digests and deeper cohort stats.",
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

  useEffect(() => {
    if (!me.data?.preferences?.onboardingCompletedAt) {
      setOpen(Boolean(token));
    } else {
      setOpen(false);
    }
  }, [me.data, token]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function complete(goDashboard: boolean) {
    if (!token) return;
    await apiFetch("/api/me/preferences", {
      method: "PUT",
      token,
      body: JSON.stringify({ onboardingCompleted: true }),
    });
    await qc.invalidateQueries({ queryKey: ["me"] });
    setOpen(false);
    if (goDashboard) router.push("/dashboard");
  }

  if (!open) return null;

  const s = steps[step]!;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md px-4 pb-[env(safe-area-inset-bottom)] sm:p-4"
      role="presentation"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="glass-strong max-w-lg w-full rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 space-y-5 border border-white/10 shadow-2xl shadow-black/50 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-cyan-300/90">First session</p>
            <h2 id="onboarding-title" className="text-xl sm:text-2xl font-semibold text-white mt-1 leading-snug">
              {s.title}
            </h2>
          </div>
          <span className="text-xs text-slate-500 tabular-nums shrink-0">
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
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i === step ? "bg-cyan-400" : "bg-white/10"
              }`}
            />
          ))}
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-1">
          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((x) => x + 1)}
              className="flex-1 min-w-[140px] rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 font-semibold py-3 text-sm"
            >
              Next
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void complete(true)}
                className="flex-1 min-w-[140px] rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 font-semibold py-3 text-sm"
              >
                Enter the deck
              </button>
              <button
                type="button"
                onClick={() => void complete(false)}
                className="flex-1 min-w-[140px] rounded-full border border-white/20 py-3 text-sm font-medium text-slate-200 hover:bg-white/5"
              >
                Finish here
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="sm:px-4 py-3 text-sm text-slate-500 hover:text-white"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useQueryClient } from "@tanstack/react-query";

export function WatchToggle({
  matchId,
  initial,
}: {
  matchId: string;
  initial?: boolean;
}) {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const [on, setOn] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!token) return null;

  async function toggle() {
    setBusy(true);
    setErr(null);
    try {
      if (on) {
        await apiFetch(`/api/watchlist/${matchId}`, { method: "DELETE", token });
        setOn(false);
      } else {
        await apiFetch("/api/watchlist", { method: "POST", token, body: JSON.stringify({ matchId }) });
        setOn(true);
      }
      await qc.invalidateQueries({ queryKey: ["matches"] });
      await qc.invalidateQueries({ queryKey: ["watchlist"] });
    } catch (e) {
      setErr((e as Error).message || "Could not update watchlist");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => toggle()}
        className={`text-[11px] font-semibold rounded-full px-3 py-1.5 border transition-all duration-300 ${
          on
            ? "border-fuchsia-400/55 bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-glow hover:brightness-110"
            : "border-white/15 text-slate-300 hover:border-fuchsia-400/45 hover:text-fuchsia-100"
        }`}
      >
        {busy ? "…" : on ? "Watching" : "Watch"}
      </button>
      {err ? <span className="text-[10px] text-rose-300/90 max-w-[14rem] text-right leading-snug">{err}</span> : null}
    </div>
  );
}

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

  if (!token) return null;

  async function toggle() {
    setBusy(true);
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
    } catch {
      /* toast hook could go here */
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => toggle()}
      className={`text-xs rounded-full px-3 py-1 border transition-colors ${
        on
          ? "border-cyan-400/60 text-cyan-200 bg-cyan-500/10"
          : "border-white/15 text-slate-300 hover:border-white/30"
      }`}
    >
      {on ? "Watching" : "Watch"}
    </button>
  );
}

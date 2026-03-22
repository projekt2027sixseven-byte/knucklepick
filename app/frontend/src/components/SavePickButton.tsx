"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useQueryClient } from "@tanstack/react-query";

export function SavePickButton({ matchId }: { matchId: string }) {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!token) return null;

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch("/api/picks", {
        method: "POST",
        token,
        body: JSON.stringify({ matchId, label: "Manual save" }),
      });
      setMsg("Saved to vault");
      await qc.invalidateQueries({ queryKey: ["picks"] });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => save()}
        className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save snapshot"}
      </button>
      {msg ? <span className="text-xs text-slate-400">{msg}</span> : null}
    </div>
  );
}

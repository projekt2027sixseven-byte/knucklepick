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
        className="rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/[0.06] hover:border-knuckle-primary/30 disabled:opacity-50 transition-all"
      >
        {busy ? "Saving…" : "Save snapshot"}
      </button>
      {msg ? (
        <span
          className={`text-xs max-w-[14rem] ${msg === "Saved to vault" ? "text-emerald-300/90" : "text-rose-300/90"}`}
        >
          {msg}
        </span>
      ) : null}
    </div>
  );
}

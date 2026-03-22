"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

type UserRow = {
  id: string;
  email: string;
  role: string;
  subscription?: { plan: { slug: string } } | null;
};

export default function AdminPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [weightsJson, setWeightsJson] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const users = useQuery({
    queryKey: ["admin-users", token],
    enabled: Boolean(token && user?.role === "ADMIN"),
    queryFn: () => apiFetch<{ users: UserRow[] }>("/api/admin/users", { token }),
  });

  const weights = useQuery({
    queryKey: ["admin-weights", token],
    enabled: Boolean(token && user?.role === "ADMIN"),
    queryFn: () => apiFetch<{ weights: { key: string; value: number }[] }>("/api/admin/weights", { token }),
  });

  if (!token || user?.role !== "ADMIN") {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <p className="text-slate-300">Admin role required.</p>
      </div>
    );
  }

  async function runPipeline() {
    setMessage(null);
    try {
      const res = await apiFetch<{ matches: number; predictions: number }>("/api/admin/pipeline/run", {
        method: "POST",
        token,
      });
      setMessage(`Ingested ${res.matches} matches, ${res.predictions} predictions.`);
      await qc.invalidateQueries({ queryKey: ["matches"] });
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function saveWeights() {
    setMessage(null);
    try {
      const obj = JSON.parse(weightsJson || "{}") as Record<string, number>;
      await apiFetch("/api/admin/weights", { method: "PUT", token, body: JSON.stringify(obj) });
      setMessage("Weights saved.");
      await weights.refetch();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  useEffect(() => {
    if (!weights.data?.weights.length) return;
    setWeightsJson((prev) => {
      if (prev.trim().length > 0) return prev;
      const map = Object.fromEntries(weights.data!.weights.map((w) => [w.key, w.value]));
      return JSON.stringify(map, null, 2);
    });
  }, [weights.data]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin console</h1>
        <p className="text-slate-400 mt-2">Users, engine weights, pipeline control, configuration.</p>
      </div>
      {message ? <p className="text-sm text-oracle.cyan">{message}</p> : null}

      <section className="glass rounded-2xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">Data pipeline</h2>
          <button
            type="button"
            onClick={() => runPipeline()}
            className="rounded-full bg-oracle.gold text-pitch-950 px-4 py-2 text-sm font-semibold"
          >
            Run ingest + predict
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Executes modular adapters, persists odds, runs the full engine stack, and refreshes similarity cases.
        </p>
      </section>

      <section className="glass rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold">Engine weights (JSON map)</h2>
        <textarea
          className="w-full h-40 bg-black/40 border border-white/10 rounded-xl p-3 text-xs font-mono"
          value={weightsJson}
          onChange={(e) => setWeightsJson(e.target.value)}
        />
        <button
          type="button"
          onClick={() => saveWeights()}
          className="rounded-full border border-white/20 px-4 py-2 text-sm"
        >
          Save weights
        </button>
        <p className="text-xs text-slate-500">
          Keys mirror Prisma records, e.g. <code>weight_form</code>. The runtime resolver maps them to engine
          coefficients.
        </p>
      </section>

      <section className="glass rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold">Users</h2>
        {users.isLoading ? <p className="text-sm text-slate-400">Loading…</p> : null}
        <div className="overflow-x-auto text-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-500">
                <th className="py-2">Email</th>
                <th>Role</th>
                <th>Plan</th>
              </tr>
            </thead>
            <tbody>
              {users.data?.users.map((u) => (
                <tr key={u.id} className="border-t border-white/5">
                  <td className="py-2">{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.subscription?.plan.slug ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

type UserRow = {
  id: string;
  email: string;
  role: string;
  subscription?: { plan: { slug: string } } | null;
};

type Overview = {
  counts: { users: number; matches: number; predictions: number; activeSubscriptions: number };
  lastPipelineRun: string | null;
  lastPipelineResult: unknown;
  maintenanceMode: boolean;
};

export default function AdminPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [weightsJson, setWeightsJson] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const overview = useQuery({
    queryKey: ["admin-overview", token],
    enabled: Boolean(token && user?.role === "ADMIN"),
    queryFn: () => apiFetch<Overview>("/api/admin/overview", { token }),
  });

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
        <p className="mt-2 text-xs text-slate-500">Sign in with an account that has the ADMIN role.</p>
      </div>
    );
  }

  if (overview.isError) {
    return (
      <div className="glass rounded-2xl border border-rose-500/25 p-8 text-center">
        <p className="text-sm text-rose-200">{(overview.error as Error).message}</p>
        <button
          type="button"
          onClick={() => overview.refetch()}
          className="btn-primary mt-4 text-sm"
        >
          Retry
        </button>
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

  const weightsSchema = z.record(z.string(), z.number().finite());

  async function saveWeights() {
    setMessage(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(weightsJson.trim() || "{}");
    } catch {
      setMessage("Invalid JSON — fix syntax before saving.");
      return;
    }
    const checked = weightsSchema.safeParse(parsed);
    if (!checked.success) {
      setMessage("Weights must be a flat object of string keys to finite numbers only.");
      return;
    }
    try {
      await apiFetch("/api/admin/weights", { method: "PUT", token, body: JSON.stringify(checked.data) });
      setMessage("Weights saved.");
      await weights.refetch();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function setUserRole(userId: string, role: "USER" | "ADMIN") {
    if (!token) return;
    setMessage(null);
    try {
      await apiFetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ role }),
      });
      setMessage(`Role updated to ${role}.`);
      await users.refetch();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function setMaintenance(on: boolean) {
    if (!token) return;
    setMessage(null);
    try {
      await apiFetch("/api/admin/config", {
        method: "PUT",
        token,
        body: JSON.stringify({ key: "MAINTENANCE_MODE", value: on ? "true" : "false" }),
      });
      setMessage(on ? "Maintenance mode ON (API 503 for clients)." : "Maintenance mode OFF.");
      await overview.refetch();
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
    <div className="space-y-8 pb-10">
      <div>
        <p className="page-eyebrow">Operations</p>
        <h1 className="text-3xl font-bold font-display text-white mt-2">Knuckle admin</h1>
        <p className="text-slate-400 mt-2 max-w-2xl">
          Pipeline control, engine weights, user visibility, and platform telemetry — production operations for the
          intelligence stack.
        </p>
      </div>
      {message ? <p className="text-sm text-sky-200 font-medium">{message}</p> : null}

      {overview.data ? (
        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Users", v: overview.data.counts.users },
            { label: "Matches (DB)", v: overview.data.counts.matches },
            { label: "Predictions", v: overview.data.counts.predictions },
            { label: "Active subs", v: overview.data.counts.activeSubscriptions },
          ].map((x) => (
            <div
              key={x.label}
              className="glass rounded-2xl p-5 border border-white/[0.07] bg-gradient-to-br from-white/[0.03] to-transparent"
            >
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{x.label}</p>
              <p className="text-2xl font-black text-white font-display tabular-nums mt-2">{x.v}</p>
            </div>
          ))}
        </section>
      ) : overview.isLoading ? (
        <div className="h-24 rounded-2xl skeleton-shimmer border border-white/[0.06]" />
      ) : null}

      {overview.data?.lastPipelineRun ? (
        <p className="text-xs text-slate-500">
          Last pipeline run · {new Date(overview.data.lastPipelineRun).toLocaleString()}
          {overview.data.maintenanceMode ? (
            <span className="ml-3 text-amber-300 font-semibold">Maintenance flag ON (AppConfig)</span>
          ) : null}
        </p>
      ) : null}

      <section className="glass rounded-2xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">Data pipeline</h2>
          <button
            type="button"
            onClick={() => runPipeline()}
            className="rounded-full bg-knuckle-primary text-white px-4 py-2 text-sm font-bold shadow-glow hover:brightness-105 transition-all"
          >
            Run ingest + predict
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Executes modular adapters, persists odds, runs the full engine stack, and refreshes similarity cases.
        </p>
      </section>

      <section className="glass rounded-2xl p-4 space-y-3 border border-amber-500/15">
        <h2 className="font-semibold text-amber-100">Maintenance (AppConfig)</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          When enabled, the API returns <span className="text-slate-400">503</span> for all routes except{" "}
          <code className="text-[11px]">/api/health</code> and <code className="text-[11px]">/api/ready</code>. Stripe
          webhooks are unaffected. You can also set <code className="text-[11px]">MAINTENANCE_MODE</code> in server env
          for an instant kill-switch.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMaintenance(true)}
            className="rounded-full border border-amber-500/40 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/10"
          >
            Enable maintenance
          </button>
          <button
            type="button"
            onClick={() => setMaintenance(false)}
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/[0.06]"
          >
            Disable maintenance
          </button>
        </div>
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
        {users.isError ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-rose-300">{(users.error as Error).message}</p>
            <button
              type="button"
              onClick={() => void users.refetch()}
              className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-white/[0.06]"
            >
              Retry
            </button>
          </div>
        ) : null}
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
                  <td>
                    <select
                      className="bg-black/50 border border-white/15 rounded-lg px-2 py-1 text-xs text-white"
                      value={u.role}
                      disabled={u.id === user?.id}
                      title={u.id === user?.id ? "Change another user’s role — not your own from this row." : undefined}
                      onChange={(e) => {
                        const role = e.target.value as "USER" | "ADMIN";
                        if (role === u.role) return;
                        void setUserRole(u.id, role);
                      }}
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
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

import { z } from "zod";

/** Aligns with match/user Prisma cuid-style ids across REST routes. */
export const resourceIdSchema = z.string().min(8).max(64);

export function parseResourceId(
  raw: string | string[] | undefined
): { ok: true; id: string } | { ok: false } {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === undefined) return { ok: false };
  const r = resourceIdSchema.safeParse(v);
  return r.success ? { ok: true, id: r.data } : { ok: false };
}

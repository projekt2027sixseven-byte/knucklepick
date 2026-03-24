import { z } from "zod";

/** Used only for metadata / OG — never localhost in production when VERCEL_URL is set. */
const APP_FALLBACK = "http://localhost:3001";

function resolveVercelUrl(): string | null {
  const raw = process.env.VERCEL_URL?.trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

function resolveAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit;
  return resolveVercelUrl() ?? APP_FALLBACK;
}

const appUrlSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export type PublicEnv = z.infer<typeof appUrlSchema>;

let cachedPublic: PublicEnv | null = null;

/** Canonical site URL for metadata / Open Graph (server). */
export function getPublicEnv(): PublicEnv {
  if (cachedPublic) return cachedPublic;
  const appUrl = resolveAppUrl();
  const parsed = appUrlSchema.safeParse({ NEXT_PUBLIC_APP_URL: appUrl });
  cachedPublic = parsed.success
    ? parsed.data
    : { NEXT_PUBLIC_APP_URL: resolveVercelUrl() ?? APP_FALLBACK };
  return cachedPublic;
}

/**
 * Base URL for browser API calls.
 * - If `NEXT_PUBLIC_API_URL` is set → use it (direct; backend must allow CORS for this origin).
 * - Otherwise in the browser → same-origin `/api/*` (use with `next.config` rewrites + `BACKEND_PROXY_URL` on Vercel).
 * - During local SSR or tooling → localhost API.
 */
export function getApiBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (typeof window !== "undefined") return "";
  return "http://localhost:4000";
}

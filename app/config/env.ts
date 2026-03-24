import { z } from "zod";

const boolish = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    /** Direct DB URL for migrations (Supabase pooler / PgBouncer). Defaults to DATABASE_URL when unset in process.env — set explicitly in production if you use a pooler. */
    DIRECT_URL: z.string().min(1).optional(),
    JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
    PORT: z.coerce.number().default(4000),
    /** Public browser origin for the Next.js app (CORS + Stripe redirects). */
    FRONTEND_URL: z.string().url().default("http://localhost:3001"),
    /** Optional: public API base for links and webhooks (e.g. https://api.example.com). */
    BACKEND_URL: z.string().url().optional(),
    REDIS_URL: z.string().optional(),
    FOOTBALL_API_KEY: z.string().optional(),
    ODDS_API_KEY: z.string().optional(),
    MOCK_DATA_MODE: boolish,
    /** Instant kill-switch — returns 503 for API routes (except health/ready). Also see AppConfig MAINTENANCE_MODE. */
    MAINTENANCE_MODE: boolish,
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_STARTER: z.string().optional(),
    STRIPE_PRICE_PRO: z.string().optional(),
    STRIPE_PRICE_ULTIMATE: z.string().optional(),
    /** Resend API for digest emails (https://resend.com). When unset, digest fan-out logs but does not send mail. */
    RESEND_API_KEY: z.string().optional(),
    /** Verified sender in Resend, e.g. Knuckle <digest@yourdomain.com> */
    DIGEST_FROM_EMAIL: z.string().optional(),
    /** Comma-separated extra CORS origins (e.g. Vercel preview URLs). */
    CORS_ORIGINS: z.string().optional(),
    /** Set to "false" or "0" to disable cron jobs (e.g. secondary instances). Default: enabled. */
    SCHEDULER_ENABLED: z.preprocess((v) => {
      if (v === "false" || v === "0") return false;
      return true;
    }, z.boolean()),
    /** Trust X-Forwarded-* from reverse proxy (Railway, Render, etc.). Default: on in production. */
    TRUST_PROXY: z.preprocess((v) => {
      if (v === "true" || v === "1") return true;
      if (v === "false" || v === "0") return false;
      return process.env.NODE_ENV === "production";
    }, z.boolean()),
    /** Shown on GET /api/health (set in CI/CD or platform env). */
    APP_VERSION: z.string().optional(),
    /** Optional git SHA for health metadata (do not log secrets). */
    GIT_COMMIT: z.string().max(64).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (!data.FRONTEND_URL.startsWith("https://") && !data.FRONTEND_URL.startsWith("http://localhost")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "FRONTEND_URL in production should use https:// (or http://localhost for local prod tests)",
          path: ["FRONTEND_URL"],
        });
      }
      const jwt = data.JWT_SECRET;
      if (/change-me/i.test(jwt) || /^password$/i.test(jwt) || /^secret$/i.test(jwt) || /^admin$/i.test(jwt)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "JWT_SECRET must not use a placeholder value in production",
          path: ["JWT_SECRET"],
        });
      }
      if (jwt.length < 24) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "JWT_SECRET should be at least 24 characters in production",
          path: ["JWT_SECRET"],
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

function applyDirectUrlDefaults(raw: Record<string, string | undefined>): Record<string, string | undefined> {
  const next = { ...raw };
  if (!next.DIRECT_URL && next.DATABASE_URL) {
    next.DIRECT_URL = next.DATABASE_URL;
  }
  return next;
}

/** Ensures Prisma sees DIRECT_URL when the schema uses `directUrl` (mirrors DATABASE_URL if unset). */
export function applyDirectUrlToProcessEnv(): void {
  if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
}

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(applyDirectUrlDefaults(process.env as Record<string, string | undefined>));
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg = `Invalid environment: ${JSON.stringify({ fieldErrors: flat.fieldErrors, formErrors: flat.formErrors })}`;
    throw new Error(msg);
  }
  cached = parsed.data;
  return cached;
}

export function clearEnvCache(): void {
  cached = null;
}

/** Extra CORS origins from CORS_ORIGINS (comma-separated). */
export function parseExtraCorsOrigins(env: Env): string[] {
  if (!env.CORS_ORIGINS?.trim()) return [];
  return env.CORS_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Adds the apex ↔ `www.` variant of `FRONTEND_URL` so browser API calls succeed whether
 * visitors use `https://example.com` or `https://www.example.com` (set `FRONTEND_URL` to your canonical host).
 * Skips localhost. Merged with `CORS_ORIGINS` in the API CORS allow-list.
 */
export function expandFrontendCorsOrigins(primary: string): string[] {
  const out = new Set<string>([primary.replace(/\/$/, "")]);
  try {
    const u = new URL(primary);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return [...out];
    }
    const port = u.port ? `:${u.port}` : "";
    const proto = u.protocol;
    if (host.startsWith("www.")) {
      const apex = host.slice(4);
      if (apex) out.add(`${proto}//${apex}${port}`);
    } else {
      out.add(`${proto}//www.${host}${port}`);
    }
  } catch {
    /* ignore malformed URL */
  }
  return [...out];
}

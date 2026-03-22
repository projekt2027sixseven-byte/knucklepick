import { z } from "zod";

/** Safe defaults so `metadataBase` and client config never throw during `next build` on Vercel. */
const FALLBACK: { NEXT_PUBLIC_API_URL: string; NEXT_PUBLIC_APP_URL: string } = {
  NEXT_PUBLIC_API_URL: "http://localhost:4000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3001",
};

function resolveVercelUrl(): string | null {
  const raw = process.env.VERCEL_URL?.trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

function resolveAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit;
  return resolveVercelUrl() ?? FALLBACK.NEXT_PUBLIC_APP_URL;
}

const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cached: PublicEnv | null = null;

export function getPublicEnv(): PublicEnv {
  if (cached) return cached;
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? FALLBACK.NEXT_PUBLIC_API_URL).trim() || FALLBACK.NEXT_PUBLIC_API_URL;
  const appUrl = resolveAppUrl();

  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_APP_URL: appUrl,
  });

  if (parsed.success) {
    cached = parsed.data;
    return cached;
  }

  const vercelFallback = resolveVercelUrl();
  const retry = publicEnvSchema.safeParse({
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_APP_URL: vercelFallback ?? FALLBACK.NEXT_PUBLIC_APP_URL,
  });

  cached = retry.success ? retry.data : FALLBACK;
  return cached;
}

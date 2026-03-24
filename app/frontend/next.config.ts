import path from "path";
import type { NextConfig } from "next";

/** Repo root when Next root is `app/frontend` (Vercel + local monorepo). */
const monorepoRoot = path.resolve(__dirname, "../..");

/** Vercel preview uses NODE_ENV=production; only enable HSTS on prod or non-Vercel production builds. */
const isProdDeploy =
  process.env.VERCEL_ENV === "production" ||
  (process.env.NODE_ENV === "production" && !process.env.VERCEL);

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProdDeploy
    ? ([
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ] as const)
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /** Hoisted workspace deps live under root `node_modules`; webpack must search there for PostCSS/Tailwind. */
  webpack: (config) => {
    const rootModules = path.join(monorepoRoot, "node_modules");
    const modules = config.resolve.modules ?? [];
    if (!modules.includes(rootModules)) {
      config.resolve.modules = [rootModules, ...modules];
    }
    return config;
  },
  /**
   * When `NEXT_PUBLIC_API_URL` is unset, the browser calls same-origin `/api/*`.
   * This proxies those requests to your Express API (set `BACKEND_PROXY_URL` on Vercel).
   * If `NEXT_PUBLIC_API_URL` is set, the client talks to the API directly (CORS must allow the site origin).
   */
  async rewrites() {
    const direct = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (direct) return [];
    const backend = process.env.BACKEND_PROXY_URL?.trim();
    if (!backend) return [];
    const b = backend.replace(/\/$/, "");
    return [{ source: "/api/:path*", destination: `${b}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

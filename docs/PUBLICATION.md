# First publication (e.g. www.knuckleaigroup.com)

Railway (API) + Vercel (Next.js) + managed Postgres. This file is the operator checklist; keep secrets in the platform dashboards only.

## DNS (Vercel)

1. In Vercel → Project → **Domains**: add `www.knuckleaigroup.com` and `knuckleaigroup.com`.
2. Set **redirect** so one canonical host redirects to the other (recommended: apex → `www`).
3. Use Vercel’s DNS records until the domain verifies.

## Railway (backend)

- **Root directory:** repository root (same folder as root `package.json`).
- **Build:** `railway.toml` runs `npm ci --include=dev`, Prisma generate, and backend `tsc`.
- **Start:** `npm run start -w @match-oracle/backend`
- **Health:** `GET /api/health` (liveness), `GET /api/ready` (DB).

### Required env vars (Railway)

| Variable | Example / notes |
|----------|-----------------|
| `DATABASE_URL` | Postgres connection string |
| `DIRECT_URL` | Same as `DATABASE_URL` unless your host needs a non-pooler URL for migrations |
| `JWT_SECRET` | 24+ random chars in production |
| `FRONTEND_URL` | `https://www.knuckleaigroup.com` (your **canonical** browser origin; Stripe return URLs use this) |
| `NODE_ENV` | `production` |

CORS automatically allows both `https://www.knuckleaigroup.com` and `https://knuckleaigroup.com` when `FRONTEND_URL` is one of them. Add previews via `CORS_ORIGINS`.

### Optional env vars

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | Cache + distributed cron locks |
| `FOOTBALL_API_KEY` / `ODDS_API_KEY` | Live feeds; omit or `MOCK_DATA_MODE=true` for synthetic |
| `MOCK_DATA_MODE` | `true` forces demo data |
| `STRIPE_*` | Billing; omit = checkout disabled (app stays usable) |
| `RESEND_API_KEY` / `DIGEST_FROM_EMAIL` | Digest email |
| `CORS_ORIGINS` | Extra origins (comma-separated) |
| `SCHEDULER_ENABLED` | `false` on secondary instances |
| `MAINTENANCE_MODE` | Instant 503 (except health/ready) |

### After first deploy

1. `GET https://<your-railway-host>/api/ready` → `ready: true`
2. Run Prisma against production DB (from your machine or a one-off job): `npx prisma db push` or `migrate deploy`
3. Optional seed: `ALLOW_SEED=true` only if you intend to seed production
4. Create an admin user or promote role in DB; run **Admin → Data pipeline** once for fixtures

## Vercel (frontend)

- **Root Directory:** `app/frontend` (required).
- **Framework:** Next.js (see `app/frontend/vercel.json` for monorepo install/build).
- **Install:** `cd ../.. && npm ci --include=dev` (see `vercel.json`). The frontend workspace keeps **Tailwind, PostCSS, Autoprefixer, TypeScript, ESLint, and `@types/*` in `dependencies`** so production installs still get everything **`next build`** needs.
- **Monorepo:** `app/frontend/next.config.ts` prepends the **repo root `node_modules`** to webpack `resolve.modules` so `require('tailwindcss')` inside Next’s PostCSS pipeline resolves when npm hoists packages to the workspace root (fixes “Cannot find module 'tailwindcss'” on Vercel).
- **Optional:** set `NEXT_TELEMETRY_DISABLED=1` in Vercel → Environment Variables to skip Next.js build telemetry (cosmetic only).
- **`npm audit` warnings** on install do not fail the build; run `npm audit` locally on the default branch and merge Dependabot PRs when you’re ready.

### Required env vars (Vercel)

| Variable | Value |
|----------|--------|
| `BACKEND_PROXY_URL` | `https://<your-railway-service>.up.railway.app` (no trailing slash) |
| `NEXT_PUBLIC_APP_URL` | `https://www.knuckleaigroup.com` |

Do **not** set `NEXT_PUBLIC_API_URL` if you use the proxy (browser stays same-origin `/api/*`).

### Recommended

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Public contact, e.g. `hello@knuckleaigroup.com` |

### Optional

| Variable | Purpose |
|----------|---------|
| `VERCEL_URL` | Set automatically by Vercel if `NEXT_PUBLIC_APP_URL` is unset |

## Stripe (when ready)

Webhook URL: `https://<railway-api>/api/billing/webhook` — raw JSON body. Set `STRIPE_WEBHOOK_SECRET` and price ID env vars on Railway.

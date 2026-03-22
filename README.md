# Oracle Pitch (Match Oracle Elite AI)

Founder-grade monorepo for a premium football intelligence platform: transparent modeling, trust indexing, watchlists, vault snapshots, digest hooks, Redis-aware caching (with in-memory fallback), Stripe monetization, and a control-room UX.

## Structure

- `app/frontend` — Next.js App Router + premium shell (sidebar, onboarding), TanStack Query + Zustand
- `app/backend` — Express API, auth, billing webhooks, watchlist/vault/preferences/digest/insights routes
- `app/db` — Prisma schema (entitlements per plan, user preferences, watchlist, saved picks)
- `app/engines` — Prediction core + **trust/calibration** helpers, goals bands, methodology transparency
- `app/integrations` — Football + odds adapters with mock fallbacks
- `app/services` — Ingestion + prediction persistence pipeline, digest builder
- `app/jobs` — Cron: ingest 6h/30m, digest hourly snapshot, daily fan-out hook (08:10 UTC); Redis-backed job locks when `REDIS_URL` is set
- `app/utils` / `app/config` / `app/constants` — Cache, env validation, product constants

## Prerequisites

- Node.js 20+
- Docker (optional, for Postgres + Redis)

## Local setup

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET, DATABASE_URL, DIRECT_URL (same as DATABASE_URL for local Postgres)
docker compose up -d   # if you use the bundled Postgres/Redis
npm install
npx prisma generate --schema app/db/prisma/schema.prisma
npx prisma db push --schema app/db/prisma/schema.prisma
npm run db:seed
npm run dev
```

- Frontend: **`npm run dev -w app/frontend`** runs `node scripts/dev.cjs`, which tries ports **3001 → 3002 → 3500 → 3456 → 4321** on **127.0.0.1**. If the console shows a port other than 3001, set `FRONTEND_URL=http://localhost:<that-port>` in the root `.env`. For a fixed port: `npm run dev:3001 -w app/frontend`.
- Backend: `http://localhost:4000/api/health` and `http://localhost:4000/api/ready` (ready checks the database).
- Copy `app/frontend/.env.example` to `app/frontend/.env.local` and set `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_APP_URL` (or rely on defaults for localhost).

### Seeded admin (development only)

- Email: `admin@matchoracle.local`
- Password: `Admin12345678!`

Run **Admin → Data pipeline** once to populate mock fixtures and predictions.

## Environment variables

### Backend (root `.env` or Railway/Render)

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL URL used by the app (pooler URL is OK). |
| `DIRECT_URL` | Yes* | Direct Postgres URL for Prisma migrations. Use the same value as `DATABASE_URL` unless your host requires a separate direct URL (e.g. Supabase). |
| `JWT_SECRET` | Yes | HS256 signing secret (16+ characters). |
| `FRONTEND_URL` | Yes | Public origin of the Next app (`https://…` in production). CORS + Stripe redirects. |
| `PORT` | No | Default `4000`. |
| `BACKEND_URL` | No | Optional public API URL for docs/links. |
| `REDIS_URL` | No | Upstash / Railway Redis; cache + cron locks fall back to in-memory if unset. |
| `FOOTBALL_API_KEY` / `ODDS_API_KEY` | No | API-Sports + The Odds API; empty ⇒ mock data (or set `MOCK_DATA_MODE=true`). |
| `MOCK_DATA_MODE` | No | `true` / `1` forces synthetic fixtures. |
| `CORS_ORIGINS` | No | Comma-separated extra allowed origins (e.g. Vercel preview URLs). |
| `SCHEDULER_ENABLED` | No | Set to `false` or `0` to disable cron (e.g. secondary API instance). |
| `TRUST_PROXY` | No | Defaults to **on** in `NODE_ENV=production` for `X-Forwarded-For` / rate limits. |
| `STRIPE_SECRET_KEY` | Billing | Live Stripe secret. |
| `STRIPE_WEBHOOK_SECRET` | Webhooks | From Stripe Dashboard → Webhooks. |
| `STRIPE_PRICE_STARTER` / `PRO` / `ULTIMATE` | Checkout | Stripe Price IDs per plan. |
| `ALLOW_SEED` | Seed in prod | Must be `true` to run `npm run db:seed` when `NODE_ENV=production`. |
| `APP_VERSION` | No | Shown on `GET /api/health` (e.g. semver or release tag). |
| `GIT_COMMIT` | No | Optional git SHA on `GET /api/health` (short hash is fine). |

### Frontend (`app/frontend/.env.local` or Vercel)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend base URL (`https://your-api.up.railway.app`). |
| `NEXT_PUBLIC_APP_URL` | Canonical public site URL for metadata. On Vercel, `VERCEL_URL` is used if unset. |

Never put secrets in `NEXT_PUBLIC_*` variables.

## Production deployment

### CI

GitHub Actions runs `npm ci` and `npm run verify` on pushes and pull requests to `main` / `master` (see `.github/workflows/ci.yml`). Dependabot is configured for npm (`.github/dependabot.yml`).

### Architecture

- **Frontend:** Vercel (Next.js)
- **Backend:** Railway or Render (Node + Express), or any container host using the root `Dockerfile`
- **Database:** Supabase Postgres, Railway Postgres, or any managed Postgres
- **Redis (optional):** Upstash or Railway Redis — improves cache sharing and distributed cron locks

### Backend (Docker)

1. Build from the repository root: `docker build -t match-oracle-api .`
2. Run with real env vars (at minimum `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `FRONTEND_URL`; `PORT` if your host does not inject it).
3. The image runs `npm run start -w @match-oracle/backend` (Express + `tsx`). Prisma generate uses placeholder URLs during `npm ci`; at runtime the app uses your live `DATABASE_URL`.

### Database

1. Create a Postgres database and set `DATABASE_URL`.
2. Set `DIRECT_URL` to the same string unless the provider gives a separate direct URL for migrations.
3. Apply schema:

```bash
npx prisma generate --schema app/db/prisma/schema.prisma
npx prisma db push --schema app/db/prisma/schema.prisma   # first-time / prototyping
# or, once you maintain migration history:
npm run db:migrate:deploy
```

4. Seed is optional and **blocked in production** unless `ALLOW_SEED=true`.

### Backend (Railway)

1. New service from this repo; set **Start Command** to `npm run start -w @match-oracle/backend` (see `railway.toml`), or use **Docker** from the root `Dockerfile`.
2. Add environment variables from the table above. Use a strong `JWT_SECRET` (24+ characters, no placeholder strings) in production — the API validates this when `NODE_ENV=production`.
3. Health checks: `GET /api/health` (liveness; `railway.toml` sets `healthcheckPath`), `GET /api/ready` (readiness + DB).

### Backend (Render)

See `render.yaml` as a starting blueprint. It provisions a Postgres instance and wires `DATABASE_URL` / `DIRECT_URL`. You must still set `JWT_SECRET`, `FRONTEND_URL`, and optional Stripe/Redis vars in the Render dashboard.

### Frontend (Vercel)

1. Import the Git repo.
2. Set **Root Directory** to `app/frontend` (recommended).
3. The included `app/frontend/vercel.json` runs `npm install` and `npm run build -w @match-oracle/frontend` from the monorepo root.
4. Set `NEXT_PUBLIC_API_URL` to your public API URL and `NEXT_PUBLIC_APP_URL` to the Vercel URL (or your custom domain).

### Stripe

1. Create products/prices and copy Price IDs into `STRIPE_PRICE_*`.
2. Add a webhook endpoint: `https://<your-api>/api/billing/webhook` — events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`.
3. Set `STRIPE_WEBHOOK_SECRET` from the webhook signing secret.
4. The API expects **raw JSON** for webhooks (configured before `express.json()` in `app/backend/src/index.ts`).

### Cron / jobs

Scheduled tasks run inside the **backend** process (`node-cron`). Run **one** API instance with `SCHEDULER_ENABLED` default, or disable on replicas via `SCHEDULER_ENABLED=false`. With `REDIS_URL`, overlapping runs are skipped via a distributed lock.

## API highlights

- `GET /api/health` — Liveness
- `GET /api/ready` — Readiness (DB)
- `GET /api/matches` — Intelligence grid (optional auth for watchlist flags, ~90s cache)
- `GET /api/matches/:id` — Authenticated detail with metering + entitlements
- `GET|POST|DELETE /api/watchlist` — Watchlist
- `GET|POST|DELETE /api/picks` — Vault snapshots
- `GET|PUT /api/me/preferences` — Digest + onboarding
- `GET /api/digest/today` — Pro+ digest
- `GET /api/insights/platform` — Trust / transparency
- `POST /api/auth/register|login` — JWT bearer auth
- `POST /api/billing/checkout` — Stripe Checkout session
- `POST /api/billing/webhook` — Stripe events (subscription lifecycle + payment failures)
- `POST /api/admin/*` — Admin (JWT + `ADMIN` role)

## Subscription tiers

| Plan | Premium views / day | Watchlist | Vault saves | Digest |
| --- | --- | --- | --- | --- |
| Starter | 5 | 25 | 40 | ✗ |
| Pro | 20 | 80 | 160 | ✓ |
| Ultimate | ∞ | ∞ | ∞ | ✓ (+ API flag) |

Premium fields lock once the daily quota is exhausted. Entitlements are enforced server-side; `TRIALING` subscriptions receive full plan access.

## Troubleshooting

- **Startup fails in production with JWT / env errors:** With `NODE_ENV=production`, `JWT_SECRET` must be at least 24 characters and cannot match common placeholders (e.g. containing `change-me`, or values like `password` / `secret` / `admin`). Set `APP_VERSION` / `GIT_COMMIT` only for observability; they are optional.
- **CORS errors:** Set `FRONTEND_URL` to the exact browser origin (scheme + host, no trailing path). Add previews to `CORS_ORIGINS`.
- **Prisma / `DIRECT_URL`:** Must be set in the environment where you run `prisma migrate` / `generate` if `directUrl` is present in `schema.prisma` (duplicate `DATABASE_URL` when not using a pooler).
- **Stripe webhook 400:** Check `STRIPE_WEBHOOK_SECRET` and that the route receives **raw** body (not parsed JSON).
- **Rate limits (429):** Defaults are global 120/min and stricter limits on `/api/auth/*`. Behind a proxy, ensure `TRUST_PROXY` is enabled in production.

## Verification

```bash
npm run verify
```

Runs Prisma generate and full workspace build (backend `tsc` + frontend `next build`).
#   k n u c k l e p i c k  
 
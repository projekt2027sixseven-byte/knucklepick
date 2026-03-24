# Testing

## Windows: Prisma `EPERM` / `rename ... query_engine-windows.dll.node`

The Prisma client is generated under **`app/db/prisma/generated/client`** (not `node_modules/.prisma`), which avoids most Windows file-lock issues on the engine binary.

`npm install` does not run `prisma generate` automatically.

1. Close extra terminals, stop `npm run dev`, and pause heavy IDE indexing if needed.
2. From the repo root: `npm install`
3. Generate the client: `npm run db:generate`  
   If you still see **EPERM**, run **`npm run db:generate:clean`** (removes `app/db/prisma/generated` and legacy `node_modules/.prisma`, then runs `prisma generate`).
4. Optional: add a Windows Defender exclusion for this project folder if the error persists.

## Prerequisites

- Node 20+
- PostgreSQL with `DATABASE_URL` (and `JWT_SECRET`, etc.) in the repo root `.env`
- Seeded data: `npm run setup:local` or at least `npm run db:seed` so matches with predictions exist

## Backend (API integration)

Runs against your real `DATABASE_URL`. Creates a throwaway user (`vitest-*@integration.test`) and deletes it in `afterAll`.

```bash
npm run test -w @match-oracle/backend
```

From the repo root:

```bash
npm run test
```

## End-to-end (Playwright)

Requires the **frontend** dev server (and API reachable from the browser via `NEXT_PUBLIC_API_URL` or proxy).

`playwright.config.ts` and `e2e/` are excluded from the Next.js typecheck. Install the runner, then:

```bash
# Terminal 1 — from repo root
npm run dev

# Terminal 2
cd app/frontend
npx playwright install chromium
npm run test:e2e
```

`PLAYWRIGHT_BASE_URL` defaults to `http://localhost:3001`. Override if your Next port differs.

Optional: set `E2E_EMAIL` / `E2E_PASSWORD` for a login journey (seed admin exists after `db:seed`).

## CI

- Run `npm run test -w @match-oracle/backend` with Postgres service and env injected.
- E2E is optional in CI unless you start the stack and run Playwright.

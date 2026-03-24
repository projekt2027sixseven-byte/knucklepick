import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { expandFrontendCorsOrigins, loadEnv, parseExtraCorsOrigins } from "../../config/env";
import { prisma } from "./prisma";
import { globalLimiter } from "./middleware/rateLimit";
import { handleStripeWebhook } from "./routes/billing";
import authRouter from "./routes/auth";
import matchesRouter from "./routes/matches";
import adminRouter from "./routes/admin";
import billingRouter from "./routes/billing";
import watchlistRouter from "./routes/watchlist";
import picksRouter from "./routes/picks";
import preferencesRouter from "./routes/preferences";
import digestRouter from "./routes/digest";
import insightsRouter from "./routes/insights";
import metaRouter from "./routes/meta";
import { maintenanceMiddleware } from "./middleware/maintenanceMiddleware";
import { log } from "./lib/logger";

export function createApp(): express.Application {
  const env = loadEnv();
  const app = express();

  if (env.TRUST_PROXY) {
    app.set("trust proxy", 1);
  }

  function corsOriginDelegate(
    origin: string | undefined,
    cb: (err: Error | null, allow?: boolean) => void
  ): void {
    const e = loadEnv();
    const extras = parseExtraCorsOrigins(e);
    const allowList = new Set([...expandFrontendCorsOrigins(e.FRONTEND_URL), ...extras]);

    if (e.NODE_ENV === "production") {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (allowList.has(origin)) {
        cb(null, true);
        return;
      }
      cb(null, false);
      return;
    }
    if (!origin) {
      cb(null, true);
      return;
    }
    try {
      const u = new URL(origin);
      const ok = u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
      cb(null, ok);
    } catch {
      cb(null, false);
    }
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(
    cors({
      origin: corsOriginDelegate,
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(globalLimiter);

  app.post(
    "/api/billing/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"];
      const result = await handleStripeWebhook(
        req.body as Buffer,
        typeof sig === "string" ? sig : Array.isArray(sig) ? sig[0] : undefined
      );
      if (!result.received) {
        res.status(400).send(result.error ?? "Webhook error");
        return;
      }
      res.json({ received: true });
    }
  );

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      service: "knuckle-backend",
      env: env.NODE_ENV,
      demoPublicLaunch: Boolean(env.DEMO_PUBLIC_LAUNCH),
      mockDataMode: Boolean(env.MOCK_DATA_MODE),
      version: env.APP_VERSION ?? null,
      commit: env.GIT_COMMIT ?? null,
      maintenance: Boolean(env.MAINTENANCE_MODE),
      ts: new Date().toISOString(),
    });
  });

  app.get("/api/ready", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        ok: true,
        ready: true,
        db: "up",
        ts: new Date().toISOString(),
      });
    } catch (e) {
      log.error("readiness_db_failed", { err: String(e) });
      res.status(503).json({
        ok: false,
        ready: false,
        db: "down",
        ts: new Date().toISOString(),
      });
    }
  });

  app.use(maintenanceMiddleware);

  app.use("/api/auth", authRouter);
  app.use("/api/matches", matchesRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/billing", billingRouter);
  app.use("/api/watchlist", watchlistRouter);
  app.use("/api/picks", picksRouter);
  app.use("/api/me/preferences", preferencesRouter);
  app.use("/api/digest", digestRouter);
  app.use("/api/insights", insightsRouter);
  app.use("/api/meta", metaRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    log.error("unhandled_error", { err: err instanceof Error ? err.message : String(err) });
    if (env.DEMO_PUBLIC_LAUNCH) {
      res.status(500).json({
        error: "demo_unavailable",
        message: "Demo API hit an error — try again shortly.",
      });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

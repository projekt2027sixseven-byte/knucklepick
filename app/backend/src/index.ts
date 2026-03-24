import "./bootstrap-env";
/** Must load before any `express.Router()` modules so async route rejections reach the error handler. */
import "express-async-errors";
import { loadEnv } from "../../config/env";
import { prisma } from "./prisma";
import { createApp } from "./createApp";
import { startScheduler, stopScheduler } from "../../jobs/scheduler";
import { log } from "./lib/logger";

/** Log DB host:port only (no credentials) — confirms pooler vs direct in Railway logs. */
function pgTargetForLog(url: string): string {
  try {
    const normalized = url.replace(/^postgresql:\/\//i, "http://").replace(/^postgres:\/\//i, "http://");
    const u = new URL(normalized);
    return u.port ? `${u.hostname}:${u.port}` : u.hostname;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

const env = loadEnv();
log.info("boot", {
  nodeEnv: env.NODE_ENV,
  demoPublicLaunch: env.DEMO_PUBLIC_LAUNCH,
  mockDataMode: Boolean(env.MOCK_DATA_MODE),
  prismaQueriesVia: pgTargetForLog(env.DATABASE_URL),
  prismaDirectUrlHost: pgTargetForLog(env.DIRECT_URL ?? env.DATABASE_URL),
  scheduler: env.SCHEDULER_ENABLED,
});
const app = createApp();

const port = env.PORT;
const server = app.listen(port, () => {
  log.info("http_listen", { port, frontendUrl: env.FRONTEND_URL });
  try {
    startScheduler(prisma);
  } catch (e) {
    log.error("scheduler_start_failed", { err: String(e) });
  }
});

async function shutdown(signal: string): Promise<void> {
  log.info("shutdown_signal", { signal });
  stopScheduler();
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  try {
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

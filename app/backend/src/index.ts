import "./bootstrap-env";
import { loadEnv } from "../../config/env";
import { prisma } from "./prisma";
import { createApp } from "./createApp";
import { startScheduler, stopScheduler } from "../../jobs/scheduler";
import { log } from "./lib/logger";

const env = loadEnv();
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
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

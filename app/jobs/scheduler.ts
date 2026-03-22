import cron from "node-cron";
import type { PrismaClient } from "@prisma/client";
import { loadEnv } from "../config/env";
import { ingestAndPredict } from "../services/predictionPipeline";
import { buildDailyDigest } from "../services/digestService";
import { withJobLock } from "../utils/jobLock";

const scheduledTasks: ReturnType<typeof cron.schedule>[] = [];

/** Stops all cron tasks (call on graceful shutdown). */
export function stopScheduler(): void {
  for (const t of scheduledTasks) {
    try {
      t.stop();
    } catch {
      /* ignore */
    }
  }
  scheduledTasks.length = 0;
}

export function startScheduler(prisma: PrismaClient): void {
  let env: ReturnType<typeof loadEnv>;
  try {
    env = loadEnv();
  } catch (e) {
    console.error("[cron] env load failed (non-fatal):", e);
    return;
  }
  if (!env.SCHEDULER_ENABLED) {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "info",
        service: "match-oracle-jobs",
        msg: "scheduler_disabled",
      })
    );
    return;
  }

  try {
    registerCronJobs(prisma);
  } catch (e) {
    console.error("[cron] registration failed (non-fatal):", e);
  }
}

function registerCronJobs(prisma: PrismaClient): void {
  scheduledTasks.push(
    cron.schedule("0 */6 * * *", async () => {
    const out = await withJobLock("ingest-6h", 7200, async () => {
      try {
        await ingestAndPredict(prisma);
      } catch (e) {
        console.error("[cron] ingest 6h failed", e);
      }
    });
    if (!out.ran) {
      console.log("[cron] skip ingest 6h (lock held)");
    }
    })
  );

  scheduledTasks.push(
    cron.schedule("*/30 * * * *", async () => {
    const out = await withJobLock("ingest-30m", 1500, async () => {
      try {
        await ingestAndPredict(prisma);
      } catch (e) {
        console.error("[cron] ingest 30m failed", e);
      }
    });
    if (!out.ran) {
      console.log("[cron] skip ingest 30m (lock held)");
    }
    })
  );

  scheduledTasks.push(
    cron.schedule("12 * * * *", async () => {
    const out = await withJobLock("digest-hourly", 3000, async () => {
      try {
        const digest = await buildDailyDigest(prisma);
        console.log("[digest] hourly snapshot", digest.fixtures.length, "headlines");
      } catch (e) {
        console.error("[cron] digest hourly failed", e);
      }
    });
    if (!out.ran) {
      console.log("[cron] skip digest hourly (lock held)");
    }
    })
  );

  scheduledTasks.push(
    cron.schedule("10 8 * * *", async () => {
    const out = await withJobLock("digest-fanout", 1800, async () => {
      try {
        const prefs = await prisma.userPreferences.findMany({
          where: { digestEnabled: true },
          include: { user: { include: { subscription: { include: { plan: true } } } } },
        });
        let queued = 0;
        for (const pref of prefs) {
          const ok = pref.user.subscription?.plan?.digestEnabled;
          if (!ok) continue;
          await prisma.userPreferences.update({
            where: { userId: pref.userId },
            data: { lastDigestSentAt: new Date() },
          });
          queued += 1;
        }
        console.log("[digest] daily fan-out tick", queued, "accounts (email queue hook)");
      } catch (e) {
        console.error("[cron] digest fan-out failed", e);
      }
    });
    if (!out.ran) {
      console.log("[cron] skip digest fan-out (lock held)");
    }
    })
  );

  console.log("[cron] scheduled: ingest 6h/30m, digest hourly snapshot, digest fan-out 08:10 UTC");
}

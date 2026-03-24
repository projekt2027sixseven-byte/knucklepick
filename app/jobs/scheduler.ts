import cron from "node-cron";
import type { PrismaClient } from "../db/prisma-client";
import { loadEnv } from "../config/env";
import { ingestAndPredict } from "../services/predictionPipeline";
import { buildDailyDigest } from "../services/digestService";
import { digestMailConfigured, renderDigestEmailHtml, sendDigestEmail } from "../services/digestMail";
import { withJobLock } from "../utils/jobLock";
import { settleFinishedMatches } from "../services/predictionSettlement";

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
        service: "knuckle-jobs",
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
    cron.schedule("*/15 * * * *", async () => {
      const out = await withJobLock("settle-matches", 600, async () => {
        try {
          const r = await settleFinishedMatches(prisma);
          if (r.settled > 0) {
            console.log(JSON.stringify({ ts: new Date().toISOString(), level: "info", msg: "settlements", settled: r.settled }));
          }
        } catch (e) {
          console.error("[cron] settle matches failed", e);
        }
      });
      if (!out.ran) {
        console.log("[cron] skip settle (lock held)");
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
        const mailReady = digestMailConfigured();
        const prefs = await prisma.userPreferences.findMany({
          where: { digestEnabled: true },
          include: { user: { include: { subscription: { include: { plan: true } } } } },
        });
        const digest = await buildDailyDigest(prisma);
        const rows = digest.fixtures.map((f) => ({
          headline: f.headline,
          kickoff: new Date(f.kickoff).toISOString(),
          home: f.home,
          away: f.away,
        }));
        let attempted = 0;
        let sent = 0;
        if (!mailReady) {
          await prisma.digestLog.create({
            data: {
              status: "SKIPPED",
              sentAt: new Date(),
              payload: {
                kind: "daily_fanout",
                reason: "RESEND_NOT_CONFIGURED",
                eligibleUsers: prefs.filter((p) => p.user.subscription?.plan?.digestEnabled).length,
              },
            },
          });
          console.log("[digest] fan-out skipped — set RESEND_API_KEY and DIGEST_FROM_EMAIL to send email");
          return;
        }
        for (const pref of prefs) {
          const eligible = pref.user.subscription?.plan?.digestEnabled;
          if (!eligible) continue;
          const email = pref.user.email;
          attempted += 1;
          const { html, text, subject } = renderDigestEmailHtml(rows);
          const result = await sendDigestEmail({ to: email, subject, html, text });
          if (result.ok) {
            sent += 1;
            await prisma.userPreferences.update({
              where: { userId: pref.userId },
              data: { lastDigestSentAt: new Date() },
            });
            await prisma.digestLog.create({
              data: {
                userId: pref.userId,
                status: "SENT",
                sentAt: new Date(),
                payload: { kind: "daily_digest_email", fixtures: rows.length },
              },
            });
          } else {
            await prisma.digestLog.create({
              data: {
                userId: pref.userId,
                status: "FAILED",
                error: result.error,
                payload: { kind: "daily_digest_email" },
              },
            });
          }
        }
        console.log("[digest] daily fan-out", { attempted, sent, fixtures: rows.length });
        await prisma.digestLog.create({
          data: {
            status: "SENT",
            sentAt: new Date(),
            payload: { kind: "daily_fanout_summary", attempted, sent, fixtures: rows.length },
          },
        });
      } catch (e) {
        console.error("[cron] digest fan-out failed", e);
        try {
          await prisma.digestLog.create({
            data: { status: "FAILED", error: String(e).slice(0, 2000) },
          });
        } catch {
          /* ignore */
        }
      }
    });
    if (!out.ran) {
      console.log("[cron] skip digest fan-out (lock held)");
    }
    })
  );

  console.log("[cron] scheduled: ingest 6h/30m, settle 15m, digest hourly snapshot, digest fan-out 08:10 UTC");
}

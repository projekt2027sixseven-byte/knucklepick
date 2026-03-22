import Redis from "ioredis";
import { loadEnv } from "../config/env";

const memoryLocks = new Map<string, number>();

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  try {
    const url = loadEnv().REDIS_URL;
    if (!url) {
      redis = null;
      return null;
    }
    const r = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
    r.on("error", () => {
      /* non-fatal */
    });
    redis = r;
    return r;
  } catch {
    redis = null;
    return null;
  }
}

/**
 * Best-effort distributed lock. Falls back to in-process memory when Redis is unavailable.
 * TTL prevents stuck locks if a worker crashes mid-job.
 */
export async function withJobLock<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<{ ran: boolean; result?: T }> {
  const lockKey = `joblock:${key}`;
  const r = getRedis();
  if (r) {
    try {
      const ok = await r.set(lockKey, "1", "EX", ttlSeconds, "NX");
      if (ok !== "OK") {
        return { ran: false };
      }
      try {
        const result = await fn();
        return { ran: true, result };
      } finally {
        try {
          await r.del(lockKey);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* fall through to memory */
    }
  }

  const until = memoryLocks.get(lockKey);
  if (until && until > Date.now()) {
    return { ran: false };
  }
  memoryLocks.set(lockKey, Date.now() + ttlSeconds * 1000);
  try {
    const result = await fn();
    return { ran: true, result };
  } finally {
    memoryLocks.delete(lockKey);
  }
}

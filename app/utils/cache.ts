import Redis from "ioredis";
import { loadEnv } from "../config/env";

type CacheEntry = { value: string; expiresAt: number };

const memory = new Map<string, CacheEntry>();

/** undefined = not yet initialized; null = skip Redis; Redis = client */
let redisClient: Redis | null | undefined = undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }
  try {
    const url = loadEnv().REDIS_URL;
    if (!url) {
      redisClient = null;
      return null;
    }
    const r = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
    r.on("error", () => {
      /* fallback silent */
    });
    redisClient = r;
    return r;
  } catch {
    redisClient = null;
    return null;
  }
}

export async function cacheGet(key: string): Promise<string | null> {
  const r = getRedis();
  if (r) {
    try {
      const v = await r.get(key);
      if (v != null) return v;
    } catch {
      /* memory fallback */
    }
  }
  const e = memory.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    memory.delete(key);
    return null;
  }
  return e.value;
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const r = getRedis();
  if (r) {
    try {
      await r.set(key, value, "EX", ttlSeconds);
      return;
    } catch {
      /* memory fallback */
    }
  }
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cacheDel(key: string): Promise<void> {
  const r = getRedis();
  if (r) {
    try {
      await r.del(key);
    } catch {
      /* noop */
    }
  }
  memory.delete(key);
}

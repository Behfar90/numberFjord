import { Redis } from "@upstash/redis";

import type { CacheStore } from "@/lib/ssb/cache";

// Returns undefined without credentials so tests, CI and local runs without
// Redis work uncached instead of logging warnings and failing every lookup.
export function createRedisStore(
  env: Record<string, string | undefined> = process.env,
): CacheStore | undefined {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  if (!url || !token) return undefined;

  const redis = new Redis({ url, token });
  return {
    get: (key) => redis.get(key),
    set: async (key, value, ttlSeconds) => {
      await redis.set(key, value, { ex: ttlSeconds });
    },
  };
}

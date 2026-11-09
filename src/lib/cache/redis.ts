import { Redis } from "@upstash/redis";

import type { CacheStore } from "@/lib/ssb/cache";

type Env = Record<string, string | undefined>;

// Returns undefined without credentials so tests, CI and local runs without
// Redis skip caching and rate limiting instead of failing every call.
export function createRedis(env: Env = process.env): Redis | undefined {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  if (!url || !token) return undefined;
  return new Redis({ url, token });
}

export function createRedisStore(
  env: Env = process.env,
): CacheStore | undefined {
  const redis = createRedis(env);
  if (!redis) return undefined;
  return {
    get: (key) => redis.get(key),
    set: async (key, value, ttlSeconds) => {
      await redis.set(key, value, { ex: ttlSeconds });
    },
  };
}

import { Ratelimit } from "@upstash/ratelimit";

import { createRedis } from "@/lib/cache/redis";

export interface RateLimiter {
  limit(identifier: string): Promise<{ success: boolean; reset: number }>;
}

export const CHAT_LIMITS = { perMinute: 5, perDay: 50 } as const;

// Per IP: a short window stops bursts, the daily one caps model spend.
// Without Redis there is no limiter, so local runs and tests are unlimited.
export function createChatRateLimiters(
  env: Record<string, string | undefined> = process.env,
): RateLimiter[] {
  const redis = createRedis(env);
  if (!redis) return [];
  return [
    new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(CHAT_LIMITS.perMinute, "1 m"),
      prefix: "ratelimit:chat:minute",
    }),
    new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(CHAT_LIMITS.perDay, "1 d"),
      prefix: "ratelimit:chat:day",
    }),
  ];
}

// Vercel sets both headers to the real client IP and overwrites client values.
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// Redis only ever sees a hash, so the privacy page can say no IPs are stored.
export async function hashIdentifier(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Buffer.from(digest).toString("hex").slice(0, 32);
}

// Returns the seconds to wait when a limit is hit, otherwise undefined.
// Limiters run in order and stop at the first refusal, so a request blocked
// by the burst limit doesn't also use up the daily allowance. A Redis outage
// lets requests through: an unlimited chat beats a broken one.
export async function checkRateLimit(
  request: Request,
  limiters: RateLimiter[],
  now = Date.now(),
): Promise<number | undefined> {
  if (limiters.length === 0) return undefined;
  const id = await hashIdentifier(clientIp(request.headers));
  try {
    for (const limiter of limiters) {
      const { success, reset } = await limiter.limit(id);
      if (!success) return Math.max(1, Math.ceil((reset - now) / 1_000));
    }
  } catch (error) {
    console.error("[rate-limit] check failed, allowing request:", error);
  }
  return undefined;
}

export function rateLimitMessage(retryAfterSeconds: number): string {
  return `You've asked a lot of questions in a short time. Please try again in ${formatWait(retryAfterSeconds)}.`;
}

export function formatWait(seconds: number): string {
  if (seconds < 90) return plural(seconds, "second");
  if (seconds < 90 * 60) return plural(Math.ceil(seconds / 60), "minute");
  return plural(Math.ceil(seconds / 3_600), "hour");
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

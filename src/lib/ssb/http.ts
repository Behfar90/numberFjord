import { z } from "zod";

import {
  secondsUntilNextRefresh,
  type CacheEntry,
  type ResponseCache,
} from "./cache";
import {
  SsbError,
  SsbRateLimitError,
  SsbUnavailableError,
  toSsbError,
} from "./errors";

export interface HttpConfig {
  baseUrl: string;
  lang: string;
  sourceName: string;
  maxAttempts?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  cache?: ResponseCache;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface SsbResponse<T> {
  data: T;
  url: string;
  // Set when the source was down and an expired cached copy was served.
  staleSince?: string;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1_000;
const MAX_WAIT_MS = 60_000;

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function buildUrl(
  baseUrl: string,
  path: string,
  params: Record<string, string>,
  lang: string,
): URL {
  const url = new URL(baseUrl + path);
  url.search = new URLSearchParams({ lang, ...params }).toString();
  return url;
}

// Retry-After may be seconds or an HTTP date.
export function retryDelayMs(
  retryAfter: string | null,
  attempt: number,
  now = Date.now(),
): number {
  let ms = BASE_BACKOFF_MS * 2 ** (attempt - 1);
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(seconds)) ms = seconds * 1_000;
    else if (!Number.isNaN(date)) ms = date - now;
  }
  return Math.min(Math.max(ms, 0), MAX_WAIT_MS);
}

export async function ssbFetch<T>(
  config: HttpConfig,
  path: string,
  params: Record<string, string>,
  schema: z.ZodType<T>,
  { signal }: RequestOptions = {},
): Promise<SsbResponse<T>> {
  const {
    baseUrl,
    lang,
    sourceName,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    fetch: fetchFn = fetch,
    sleep = defaultSleep,
    cache,
  } = config;
  const url = buildUrl(baseUrl, path, params, lang).toString();
  if (!cache) return { data: await fetchLive(), url };

  const cached = await readCache(cache, url, schema);
  if (cached && Date.now() < cached.freshUntil) {
    return { data: cached.data, url };
  }
  try {
    const data = await fetchLive();
    await writeCache(cache, url, data);
    return { data, url };
  } catch (err) {
    // Only outages fall back: a 404 or bad query would fail the same way again.
    const outage =
      err instanceof SsbRateLimitError || err instanceof SsbUnavailableError;
    if (outage && cached) {
      return {
        data: cached.data,
        url,
        staleSince: new Date(cached.storedAt).toISOString(),
      };
    }
    throw err;
  }

  async function fetchLive(): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      let res: Response;
      try {
        res = await fetchFn(url, {
          headers: { Accept: "application/json" },
          signal,
        });
      } catch (err) {
        if (signal?.aborted) throw err;
        throw new SsbUnavailableError(
          sourceName,
          `Network error calling ${url}`,
          undefined,
          { cause: err },
        );
      }

      if (res.status === 429 && attempt < maxAttempts) {
        await sleep(retryDelayMs(res.headers.get("Retry-After"), attempt));
        continue;
      }

      const body: unknown = await res.json().catch(() => undefined);
      if (!res.ok) throw toSsbError(sourceName, res.status, body);

      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        throw new SsbError(
          `Unexpected response shape from ${url}: ${parsed.error.message}`,
          `${sourceName} returned data in an unexpected format.`,
          res.status,
          { cause: parsed.error },
        );
      }
      return parsed.data;
    }
  }
}

// A broken or unreachable cache must never fail a request: treat it as a miss.
async function readCache<T>(
  cache: ResponseCache,
  key: string,
  schema: z.ZodType<T>,
): Promise<CacheEntry<T> | undefined> {
  try {
    const value = await cache.store.get(key);
    if (value === undefined || value === null) return undefined;
    const parsed = cacheEntrySchema(schema).safeParse(value);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

async function writeCache<T>(
  cache: ResponseCache,
  key: string,
  data: T,
): Promise<void> {
  try {
    const now = Date.now();
    const fresh = secondsUntilNextRefresh(
      new Date(now),
      cache.refreshTimes,
      cache.timeZone,
    );
    const entry: CacheEntry<T> = {
      data,
      storedAt: now,
      freshUntil: now + fresh * 1_000,
    };
    await cache.store.set(key, entry, fresh + (cache.staleSeconds ?? 0));
  } catch {
    // Same as reads: losing a cache write only costs a future API call.
  }
}

const cacheEntrySchema = <T>(data: z.ZodType<T>) =>
  z.object({ data, storedAt: z.number(), freshUntil: z.number() });

import type { z } from "zod";

import { SsbError, SsbUnavailableError, toSsbError } from "./errors";

export const SSB_BASE_URL = "https://data.ssb.no/api/pxwebapi/v2";

export type Lang = "en" | "no";

export interface SsbFetchOptions {
  lang?: Lang;
  maxAttempts?: number;
  signal?: AbortSignal;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface SsbResponse<T> {
  data: T;
  url: string;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1_000;
const MAX_WAIT_MS = 60_000;

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function buildUrl(
  path: string,
  params: Record<string, string>,
  lang: Lang,
): URL {
  const url = new URL(SSB_BASE_URL + path);
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
  path: string,
  params: Record<string, string>,
  schema: z.ZodType<T>,
  options: SsbFetchOptions = {},
): Promise<SsbResponse<T>> {
  const {
    lang = "en",
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    signal,
    fetch: fetchFn = fetch,
    sleep = defaultSleep,
  } = options;
  const url = buildUrl(path, params, lang).toString();

  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetchFn(url, {
        headers: { Accept: "application/json" },
        signal,
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      throw new SsbUnavailableError(`Network error calling ${url}`, undefined, {
        cause: err,
      });
    }

    if (res.status === 429 && attempt < maxAttempts) {
      await sleep(retryDelayMs(res.headers.get("Retry-After"), attempt));
      continue;
    }

    const body: unknown = await res.json().catch(() => undefined);
    if (!res.ok) throw toSsbError(res.status, body);

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new SsbError(
        `Unexpected response shape from ${url}: ${parsed.error.message}`,
        "Statistics Norway returned data in an unexpected format.",
        res.status,
        { cause: parsed.error },
      );
    }
    return { data: parsed.data, url };
  }
}

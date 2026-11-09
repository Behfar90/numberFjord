import { afterEach, describe, expect, it, vi } from "vitest";

import error404 from "./__fixtures__/error-404.json";
import search from "./__fixtures__/search-population.json";
import {
  SsbError,
  SsbNotFoundError,
  SsbRateLimitError,
  SsbUnavailableError,
} from "./errors";
import {
  createMemoryStore,
  type CacheStore,
  type ResponseCache,
} from "./cache";
import { buildUrl, retryDelayMs, ssbFetch, type HttpConfig } from "./http";
import { tableSearchResponseSchema } from "./schemas";

// Every test injects a fake fetch and sleep: no real network, no real waiting.

const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });

const rateLimited = (retryAfter?: string) =>
  json(
    { title: "Too many requests", status: 429 },
    429,
    retryAfter ? { "Retry-After": retryAfter } : undefined,
  );

function setup(...responses: (Response | Error)[]) {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const r of responses) {
    if (r instanceof Error) fetch.mockRejectedValueOnce(r);
    else fetch.mockResolvedValueOnce(r);
  }
  const sleep = vi.fn(async (ms: number) => {
    void ms;
  });
  return { fetch, sleep };
}

const CONFIG: HttpConfig = {
  baseUrl: "https://data.ssb.no/api/pxwebapi/v2",
  lang: "en",
  sourceName: "Statistics Norway",
};

const searchPopulation = (
  deps: Pick<HttpConfig, "fetch" | "sleep" | "cache">,
  signal?: AbortSignal,
) =>
  ssbFetch(
    { ...CONFIG, ...deps },
    "/tables",
    { query: "population" },
    tableSearchResponseSchema,
    { signal },
  );

describe("buildUrl", () => {
  it("adds lang and encodes bracketed query params", () => {
    const url = buildUrl(
      CONFIG.baseUrl,
      "/tables/07459/data",
      { "valueCodes[Tid]": "top(2)" },
      "en",
    );
    expect(url.toString()).toBe(
      "https://data.ssb.no/api/pxwebapi/v2/tables/07459/data?lang=en&valueCodes%5BTid%5D=top%282%29",
    );
  });
});

describe("retryDelayMs", () => {
  it("backs off exponentially without Retry-After", () => {
    expect([1, 2, 3].map((n) => retryDelayMs(null, n))).toEqual([
      1_000, 2_000, 4_000,
    ]);
  });

  it("honors Retry-After in seconds", () => {
    expect(retryDelayMs("5", 1)).toBe(5_000);
  });

  it("honors Retry-After as an HTTP date", () => {
    const now = Date.parse("2026-09-28T10:00:00Z");
    expect(retryDelayMs("Mon, 28 Sep 2026 10:00:10 GMT", 1, now)).toBe(10_000);
  });

  it("caps the wait at 60 seconds", () => {
    expect(retryDelayMs("3600", 1)).toBe(60_000);
  });
});

describe("ssbFetch", () => {
  it("returns validated data and the requested url", async () => {
    const { fetch, sleep } = setup(json(search));
    const res = await searchPopulation({ fetch, sleep });

    expect(res.data.tables).toHaveLength(5);
    expect(res.url).toBe(
      "https://data.ssb.no/api/pxwebapi/v2/tables?lang=en&query=population",
    );
    expect(fetch).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries a 429 after waiting, then succeeds", async () => {
    const { fetch, sleep } = setup(rateLimited("2"), json(search));
    const res = await searchPopulation({ fetch, sleep });

    expect(res.data.tables).toHaveLength(5);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledExactlyOnceWith(2_000);
  });

  it("gives up after maxAttempts 429s", async () => {
    const { fetch, sleep } = setup(rateLimited(), rateLimited(), rateLimited());
    await expect(searchPopulation({ fetch, sleep })).rejects.toBeInstanceOf(
      SsbRateLimitError,
    );
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[1_000], [2_000]]);
  });

  it("does not retry other errors", async () => {
    const { fetch, sleep } = setup(json(error404.body, error404.status));
    await expect(searchPopulation({ fetch, sleep })).rejects.toBeInstanceOf(
      SsbNotFoundError,
    );
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("maps a non-JSON 503 to SsbUnavailableError", async () => {
    const { fetch, sleep } = setup(
      new Response("<html>Maintenance</html>", { status: 503 }),
    );
    await expect(searchPopulation({ fetch, sleep })).rejects.toBeInstanceOf(
      SsbUnavailableError,
    );
  });

  it("wraps network failures in SsbUnavailableError", async () => {
    const cause = new TypeError("fetch failed");
    const { fetch, sleep } = setup(cause);
    const err = await searchPopulation({ fetch, sleep }).catch((e) => e);

    expect(err).toBeInstanceOf(SsbUnavailableError);
    expect(err.cause).toBe(cause);
  });

  it("rethrows the abort error when the caller cancels", async () => {
    const controller = new AbortController();
    controller.abort();
    const abort = new DOMException("Aborted", "AbortError");
    const { fetch, sleep } = setup(abort);

    await expect(
      searchPopulation({ fetch, sleep }, controller.signal),
    ).rejects.toBe(abort);
  });

  it("rejects a 200 whose body doesn't match the schema", async () => {
    const { fetch, sleep } = setup(json({ unexpected: true }));
    const err = await searchPopulation({ fetch, sleep }).catch((e) => e);

    expect(err).toBeInstanceOf(SsbError);
    expect(err.userMessage).toMatch(/unexpected format/);
  });
});

describe("ssbFetch with a cache", () => {
  const withStore = (store: CacheStore): ResponseCache => ({
    store,
    refreshTimes: ["05:00", "08:00", "11:30"],
    timeZone: "Europe/Oslo",
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("serves a repeated request from the cache", async () => {
    const cache = withStore(createMemoryStore());
    const { fetch, sleep } = setup(json(search));

    const first = await searchPopulation({ fetch, sleep, cache });
    const second = await searchPopulation({ fetch, sleep, cache });

    expect(second).toEqual(first);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("stores an entry that is fresh until the next refresh time", async () => {
    // 07:00 in Oslo: fresh until 08:00, then kept a day longer as a fallback.
    const now = Date.parse("2026-01-15T06:00:00Z");
    vi.useFakeTimers({ now, toFake: ["Date"] });
    const store = createMemoryStore();
    const set = vi.spyOn(store, "set");
    const { fetch, sleep } = setup(json(search));

    const res = await searchPopulation({
      fetch,
      sleep,
      cache: { ...withStore(store), staleSeconds: 86_400 },
    });

    expect(set).toHaveBeenCalledExactlyOnceWith(
      res.url,
      { data: res.data, storedAt: now, freshUntil: now + 3_600_000 },
      3_600 + 86_400,
    );
  });

  it("does not cache failed responses", async () => {
    const cache = withStore(createMemoryStore());
    const { fetch, sleep } = setup(
      json(error404.body, error404.status),
      json(search),
    );

    await expect(
      searchPopulation({ fetch, sleep, cache }),
    ).rejects.toBeInstanceOf(SsbNotFoundError);
    const res = await searchPopulation({ fetch, sleep, cache });

    expect(res.data.tables).toHaveLength(5);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("refetches when a cached value no longer matches the schema", async () => {
    const store = createMemoryStore();
    const { fetch, sleep } = setup(json(search));
    await store.set(
      "https://data.ssb.no/api/pxwebapi/v2/tables?lang=en&query=population",
      { stale: true },
      60,
    );

    const res = await searchPopulation({
      fetch,
      sleep,
      cache: withStore(store),
    });

    expect(res.data.tables).toHaveLength(5);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("falls through to the API when the cache store throws", async () => {
    const broken: CacheStore = {
      get: vi.fn().mockRejectedValue(new Error("redis down")),
      set: vi.fn().mockRejectedValue(new Error("redis down")),
    };
    const { fetch, sleep } = setup(json(search));

    const res = await searchPopulation({
      fetch,
      sleep,
      cache: withStore(broken),
    });

    expect(res.data.tables).toHaveLength(5);
    expect(broken.set).toHaveBeenCalledOnce();
  });
});

describe("ssbFetch when the source is down", () => {
  const URL_KEY =
    "https://data.ssb.no/api/pxwebapi/v2/tables?lang=en&query=population";
  const storedAt = Date.parse("2026-01-15T06:00:00Z");

  afterEach(() => {
    vi.useRealTimers();
  });

  // An entry that went stale an hour ago but is still kept as a fallback.
  async function expiredEntry() {
    vi.useFakeTimers({ now: storedAt + 2 * 3_600_000, toFake: ["Date"] });
    const store = createMemoryStore();
    await store.set(
      URL_KEY,
      { data: search, storedAt, freshUntil: storedAt + 3_600_000 },
      86_400,
    );
    const cache: ResponseCache = {
      store,
      refreshTimes: ["05:00", "08:00", "11:30"],
      timeZone: "Europe/Oslo",
      staleSeconds: 86_400,
    };
    return cache;
  }

  it("refreshes an expired entry when the source is up", async () => {
    const cache = await expiredEntry();
    const { fetch, sleep } = setup(json(search));

    const res = await searchPopulation({ fetch, sleep, cache });

    expect(fetch).toHaveBeenCalledOnce();
    expect(res.staleSince).toBeUndefined();
  });

  it.each([
    ["a 503", json({ title: "Service Unavailable" }, 503)],
    ["a network error", new TypeError("fetch failed")],
  ])("serves the expired copy after %s", async (_, failure) => {
    const cache = await expiredEntry();
    const { fetch, sleep } = setup(failure);

    const res = await searchPopulation({ fetch, sleep, cache });

    expect(res.data.tables).toHaveLength(5);
    expect(res.staleSince).toBe("2026-01-15T06:00:00.000Z");
  });

  it("serves the expired copy when rate limited after all retries", async () => {
    const cache = await expiredEntry();
    const { fetch, sleep } = setup(rateLimited(), rateLimited(), rateLimited());

    const res = await searchPopulation({ fetch, sleep, cache });

    expect(res.staleSince).toBeDefined();
  });

  it("does not hide errors a retry wouldn't fix", async () => {
    const cache = await expiredEntry();
    const { fetch, sleep } = setup(json(error404.body, error404.status));

    await expect(
      searchPopulation({ fetch, sleep, cache }),
    ).rejects.toBeInstanceOf(SsbNotFoundError);
  });

  it("fails as before when there is no cached copy", async () => {
    const cache = await expiredEntry();
    await cache.store.set(URL_KEY, undefined, 1);
    const { fetch, sleep } = setup(json({ title: "Down" }, 503));

    await expect(
      searchPopulation({ fetch, sleep, cache }),
    ).rejects.toBeInstanceOf(SsbUnavailableError);
  });
});

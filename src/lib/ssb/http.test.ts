import { describe, expect, it, vi } from "vitest";

import error404 from "./__fixtures__/error-404.json";
import search from "./__fixtures__/search-population.json";
import {
  SsbError,
  SsbNotFoundError,
  SsbRateLimitError,
  SsbUnavailableError,
} from "./errors";
import { buildUrl, retryDelayMs, ssbFetch } from "./http";
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

const searchPopulation = (options: Parameters<typeof ssbFetch>[3]) =>
  ssbFetch(
    "/tables",
    { query: "population" },
    tableSearchResponseSchema,
    options,
  );

describe("buildUrl", () => {
  it("adds lang and encodes bracketed query params", () => {
    const url = buildUrl(
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
      searchPopulation({ fetch, sleep, signal: controller.signal }),
    ).rejects.toBe(abort);
  });

  it("rejects a 200 whose body doesn't match the schema", async () => {
    const { fetch, sleep } = setup(json({ unexpected: true }));
    const err = await searchPopulation({ fetch, sleep }).catch((e) => e);

    expect(err).toBeInstanceOf(SsbError);
    expect(err.userMessage).toMatch(/unexpected format/);
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  checkRateLimit,
  clientIp,
  createChatRateLimiters,
  formatWait,
  hashIdentifier,
  type RateLimiter,
} from "./rate-limit";

const NOW = 1_800_000_000_000;

const request = (headers: HeadersInit = {}) =>
  new Request("http://localhost/api/chat", { method: "POST", headers });

const limiter = (success: boolean, resetInMs = 30_000): RateLimiter => ({
  limit: vi.fn(async () => ({ success, reset: NOW + resetInMs })),
});

describe("clientIp", () => {
  it("prefers x-real-ip", () => {
    const headers = new Headers({
      "x-real-ip": "1.1.1.1",
      "x-forwarded-for": "2.2.2.2",
    });
    expect(clientIp(headers)).toBe("1.1.1.1");
  });

  it("takes the first x-forwarded-for entry", () => {
    const headers = new Headers({ "x-forwarded-for": "2.2.2.2, 10.0.0.1" });
    expect(clientIp(headers)).toBe("2.2.2.2");
  });

  it("falls back to a shared bucket without headers", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("hashIdentifier", () => {
  it("is stable and never contains the raw IP", async () => {
    const hash = await hashIdentifier("1.1.1.1");
    expect(hash).toBe(await hashIdentifier("1.1.1.1"));
    expect(hash).not.toContain("1.1.1.1");
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("checkRateLimit", () => {
  it("allows everything without limiters", async () => {
    expect(await checkRateLimit(request(), [], NOW)).toBeUndefined();
  });

  it("allows a request every limiter accepts", async () => {
    const limiters = [limiter(true), limiter(true)];
    expect(await checkRateLimit(request(), limiters, NOW)).toBeUndefined();
  });

  it("returns the wait in seconds when a limit is hit", async () => {
    expect(await checkRateLimit(request(), [limiter(false, 12_300)], NOW)).toBe(
      13,
    );
  });

  it("stops at the first refusal", async () => {
    const minute = limiter(false);
    const day = limiter(true);
    await checkRateLimit(request(), [minute, day], NOW);
    expect(day.limit).not.toHaveBeenCalled();
  });

  it("keys limiters by the hashed client IP", async () => {
    const minute = limiter(true);
    await checkRateLimit(request({ "x-real-ip": "1.1.1.1" }), [minute], NOW);
    expect(minute.limit).toHaveBeenCalledWith(await hashIdentifier("1.1.1.1"));
  });

  it("allows the request when Redis fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const broken: RateLimiter = {
      limit: vi.fn().mockRejectedValue(new Error("redis down")),
    };
    expect(await checkRateLimit(request(), [broken], NOW)).toBeUndefined();
  });
});

describe("createChatRateLimiters", () => {
  it("creates no limiters without Redis credentials", () => {
    expect(createChatRateLimiters({})).toEqual([]);
  });
});

describe("formatWait", () => {
  it.each([
    [1, "1 second"],
    [45, "45 seconds"],
    [90, "2 minutes"],
    [60 * 60, "60 minutes"],
    [5 * 3_600, "5 hours"],
  ])("formats %i seconds as %s", (seconds, text) => {
    expect(formatWait(seconds)).toBe(text);
  });
});

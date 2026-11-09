import { afterEach, describe, expect, it, vi } from "vitest";

import { createMemoryStore, secondsUntilNextRefresh } from "./cache";

const SSB_TIMES = ["05:00", "08:00", "11:30"];
const OSLO = "Europe/Oslo";
const HOUR = 3_600;

const untilNext = (iso: string) =>
  secondsUntilNextRefresh(new Date(iso), SSB_TIMES, OSLO);

describe("secondsUntilNextRefresh", () => {
  it("picks the next refresh later the same day (winter, UTC+1)", () => {
    // 07:00 Oslo → 08:00 Oslo
    expect(untilNext("2026-01-15T06:00:00Z")).toBe(1 * HOUR);
  });

  it("skips a refresh time that is exactly now", () => {
    // 08:00 Oslo → 11:30 Oslo
    expect(untilNext("2026-01-15T07:00:00Z")).toBe(3.5 * HOUR);
  });

  it("rolls over to the first refresh of the next day", () => {
    // 13:00 Oslo → 05:00 Oslo next day
    expect(untilNext("2026-01-15T12:00:00Z")).toBe(16 * HOUR);
  });

  it("uses the summer offset (UTC+2)", () => {
    // 07:00 Oslo → 08:00 Oslo
    expect(untilNext("2026-06-15T05:00:00Z")).toBe(1 * HOUR);
  });

  it("counts the extra hour when summer time ends overnight", () => {
    // 22:00 CEST on 24 Oct → 05:00 CET on 25 Oct: 7 wall-clock hours, 8 real
    expect(untilNext("2026-10-24T20:00:00Z")).toBe(8 * HOUR);
  });

  it("counts the lost hour when summer time starts overnight", () => {
    // 22:00 CET on 28 Mar → 05:00 CEST on 29 Mar: 7 wall-clock hours, 6 real
    expect(untilNext("2026-03-28T21:00:00Z")).toBe(6 * HOUR);
  });

  it("rounds partial seconds up so the TTL is never zero", () => {
    expect(untilNext("2026-01-15T06:59:59.500Z")).toBe(1);
  });

  it("throws when no refresh times are configured", () => {
    expect(() => secondsUntilNextRefresh(new Date(), [], OSLO)).toThrow();
  });
});

describe("createMemoryStore", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns stored values until their TTL passes", async () => {
    vi.useFakeTimers();
    const store = createMemoryStore();
    await store.set("k", { a: 1 }, 60);

    vi.advanceTimersByTime(59_999);
    expect(await store.get("k")).toEqual({ a: 1 });

    vi.advanceTimersByTime(1);
    expect(await store.get("k")).toBeUndefined();
  });

  it("returns undefined for unknown keys", async () => {
    expect(await createMemoryStore().get("missing")).toBeUndefined();
  });
});

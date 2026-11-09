import { beforeEach, describe, expect, it, vi } from "vitest";

const redis = { get: vi.fn(), set: vi.fn() };
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(function () {
    return redis;
  }),
}));

const { Redis } = await import("@upstash/redis");
const { createRedisStore } = await import("./redis");

const KV = { KV_REST_API_URL: "https://kv.example", KV_REST_API_TOKEN: "t" };

describe("createRedisStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns undefined without credentials", () => {
    expect(createRedisStore({})).toBeUndefined();
    expect(createRedisStore({ KV_REST_API_URL: "https://kv.example" })).toBe(
      undefined,
    );
    expect(Redis).not.toHaveBeenCalled();
  });

  it("prefers UPSTASH_* variables over KV_*", () => {
    createRedisStore({
      ...KV,
      UPSTASH_REDIS_REST_URL: "https://upstash.example",
      UPSTASH_REDIS_REST_TOKEN: "u",
    });
    expect(Redis).toHaveBeenCalledWith({
      url: "https://upstash.example",
      token: "u",
    });
  });

  it("sets values with an expiry in seconds", async () => {
    const store = createRedisStore(KV);
    await store?.set("key", { a: 1 }, 90);
    expect(redis.set).toHaveBeenCalledWith("key", { a: 1 }, { ex: 90 });
  });

  it("passes reads through", async () => {
    redis.get.mockResolvedValueOnce({ a: 1 });
    expect(await createRedisStore(KV)?.get("key")).toEqual({ a: 1 });
  });
});

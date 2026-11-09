import { describe, expect, it } from "vitest";

import {
  SsbError,
  SsbInvalidQueryError,
  SsbNotFoundError,
  SsbRateLimitError,
  SsbTooLargeError,
  SsbUnavailableError,
} from "@/lib/ssb";

import { toToolError, withToolErrors } from "./tool-errors";

const SOURCE = "Statistics Norway";
const message = (error: unknown) =>
  (toToolError(error, SOURCE) as Error).message;

describe("toToolError", () => {
  it.each([
    ["rate limit", new SsbRateLimitError(SOURCE)],
    ["outage", new SsbUnavailableError(SOURCE, "responded 503")],
    ["unexpected response", new SsbError("bad shape", "x", 200)],
  ])("tells the model not to retry after a %s", (_, error) => {
    expect(message(error)).toMatch(/Do not retry/);
    expect(message(error)).toMatch(/Do not answer from memory/);
  });

  it("asks for a smaller selection when the query is too large", () => {
    const error = new SsbTooLargeError(SOURCE, "Too many cells selected");
    expect(message(error)).toMatch(/Select fewer values/);
    expect(message(error)).not.toMatch(/Do not retry/);
  });

  it("points to searchTables for an unknown table", () => {
    expect(message(new SsbNotFoundError(SOURCE, "responded 404"))).toMatch(
      /searchTables/,
    );
  });

  it("asks to check the codes for an invalid query", () => {
    expect(message(new SsbInvalidQueryError(SOURCE, "responded 400"))).toMatch(
      /getTableMetadata/,
    );
  });

  it("keeps the original technical detail", () => {
    expect(message(new SsbUnavailableError(SOURCE, "responded 503"))).toMatch(
      /^responded 503\./,
    );
  });

  it("passes other errors through unchanged", () => {
    const error = new Error("Unknown value codes");
    expect(toToolError(error, SOURCE)).toBe(error);
  });
});

describe("withToolErrors", () => {
  it("returns the result when nothing fails", async () => {
    expect(await withToolErrors(SOURCE, async () => 42)).toBe(42);
  });

  it("rethrows translated SSB errors", async () => {
    await expect(
      withToolErrors(SOURCE, async () => {
        throw new SsbRateLimitError(SOURCE);
      }),
    ).rejects.toThrow(/Do not retry/);
  });
});

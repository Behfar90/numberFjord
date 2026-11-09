import { describe, expect, it } from "vitest";

import { staleLabel } from "./source-line-text";

describe("staleLabel", () => {
  it("shows when the cached copy was fetched, in Oslo time", () => {
    expect(staleLabel("2026-11-09T10:07:00.000Z", "Statistics Norway")).toBe(
      "Statistics Norway was unreachable: cached copy from 9 Nov 2026, 11:07 (Oslo time)",
    );
  });
});

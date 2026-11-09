import { describe, expect, it } from "vitest";

import { errorMessage } from "./error-message";

describe("errorMessage", () => {
  it("extracts the error field from a JSON body", () => {
    expect(errorMessage(new Error('{"error":"Slow down."}'))).toBe(
      "Slow down.",
    );
  });

  it("keeps plain text messages", () => {
    expect(errorMessage(new Error("Network error"))).toBe("Network error");
  });

  it("keeps JSON without a string error field as is", () => {
    expect(errorMessage(new Error('{"message":"x"}'))).toBe('{"message":"x"}');
  });
});

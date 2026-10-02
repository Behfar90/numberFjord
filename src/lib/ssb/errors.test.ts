import { describe, expect, it } from "vitest";

import error404 from "./__fixtures__/error-404.json";
import errorTooManyCells from "./__fixtures__/error-too-many-cells.json";
import {
  SsbError,
  SsbInvalidQueryError,
  SsbNotFoundError,
  SsbRateLimitError,
  SsbTooLargeError,
  SsbUnavailableError,
  toSsbError,
} from "./errors";

const SOURCE = "Statistics Norway";

describe("toSsbError", () => {
  it("maps a real 404 to SsbNotFoundError", () => {
    const err = toSsbError(SOURCE, error404.status, error404.body);
    expect(err).toBeInstanceOf(SsbNotFoundError);
    expect(err.status).toBe(404);
    expect(err.message).toBe(
      "Statistics Norway responded 404: Non-existent table",
    );
  });

  it("maps a real 400 'Too many cells selected' to SsbTooLargeError", () => {
    const err = toSsbError(
      SOURCE,
      errorTooManyCells.status,
      errorTooManyCells.body,
    );
    expect(err).toBeInstanceOf(SsbTooLargeError);
    expect(err.status).toBe(400);
  });

  it("maps 403 to SsbTooLargeError", () => {
    expect(toSsbError(SOURCE, 403, {})).toBeInstanceOf(SsbTooLargeError);
  });

  it("maps 429 to SsbRateLimitError", () => {
    expect(toSsbError(SOURCE, 429, {})).toBeInstanceOf(SsbRateLimitError);
  });

  it("maps other 400s to SsbInvalidQueryError", () => {
    const body = { title: "Unknown variable", status: 400 };
    const err = toSsbError(SOURCE, 400, body);
    expect(err).toBeInstanceOf(SsbInvalidQueryError);
    expect(err.message).toBe(
      "Statistics Norway responded 400: Unknown variable",
    );
  });

  it.each([500, 502, 503])("maps %i to SsbUnavailableError", (status) => {
    expect(toSsbError(SOURCE, status, "<html>")).toBeInstanceOf(
      SsbUnavailableError,
    );
  });

  it("copes with a body that isn't problem+json", () => {
    const err = toSsbError(SOURCE, 503, "<html>Maintenance</html>");
    expect(err.message).toBe(
      "Statistics Norway responded 503: no problem details",
    );
  });

  it("names the configured source in the user message", () => {
    const err = toSsbError("Statistics Sweden", 404, error404.body);
    expect(err.userMessage).toBe(
      "That Statistics Sweden table could not be found.",
    );
  });
});

describe("SsbError", () => {
  it("is a real Error with a name, status and user-facing message", () => {
    const err = new SsbRateLimitError(SOURCE);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SsbError);
    expect(err.name).toBe("SsbRateLimitError");
    expect(err.userMessage).toMatch(/try again/i);
  });

  it("keeps the underlying cause for network failures", () => {
    const cause = new TypeError("fetch failed");
    const err = new SsbUnavailableError(SOURCE, "network error", undefined, {
      cause,
    });
    expect(err.cause).toBe(cause);
    expect(err.status).toBeUndefined();
  });
});

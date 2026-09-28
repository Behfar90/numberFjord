import { problemSchema } from "./schemas";

// `message` is for logs and the agent; `userMessage` is safe to show in the UI.

export class SsbError extends Error {
  readonly status: number | undefined;
  readonly userMessage: string;

  constructor(
    message: string,
    userMessage: string,
    status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
    this.status = status;
    this.userMessage = userMessage;
  }
}

export class SsbRateLimitError extends SsbError {
  constructor(message = "Rate limited by SSB (429)") {
    super(
      message,
      "Statistics Norway is receiving too many requests right now. Please try again in a minute.",
      429,
    );
  }
}

/** 403, or 400 "Too many cells selected": the query exceeds 800,000 cells. */
export class SsbTooLargeError extends SsbError {
  constructor(message: string, status?: number) {
    super(
      message,
      "That question needs more data than Statistics Norway allows in one request. Try narrowing it down, for example to fewer years or regions.",
      status,
    );
  }
}

export class SsbNotFoundError extends SsbError {
  constructor(message: string) {
    super(message, "That Statistics Norway table could not be found.", 404);
  }
}

export class SsbInvalidQueryError extends SsbError {
  constructor(message: string, status?: number) {
    super(message, "The request to Statistics Norway was not valid.", status);
  }
}

export class SsbUnavailableError extends SsbError {
  constructor(message: string, status?: number, options?: ErrorOptions) {
    super(
      message,
      "Statistics Norway is temporarily unavailable. Please try again in a few minutes.",
      status,
      options,
    );
  }
}

const TOO_MANY_CELLS = /too many cells/i;

export function toSsbError(status: number, body: unknown): SsbError {
  const problem = problemSchema.safeParse(body);
  const detail = problem.success
    ? [problem.data.title, problem.data.detail].filter(Boolean).join(": ")
    : "no problem details";
  const message = `SSB responded ${status}: ${detail}`;

  if (status === 429) return new SsbRateLimitError(message);
  if (status === 404) return new SsbNotFoundError(message);
  if (status === 403) return new SsbTooLargeError(message, status);
  if (
    status === 400 &&
    problem.success &&
    TOO_MANY_CELLS.test(problem.data.title)
  ) {
    return new SsbTooLargeError(message, status);
  }
  if (status >= 400 && status < 500) {
    return new SsbInvalidQueryError(message, status);
  }
  return new SsbUnavailableError(message, status);
}

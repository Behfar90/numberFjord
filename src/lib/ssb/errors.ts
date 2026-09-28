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
  constructor(source: string, message = `Rate limited by ${source} (429)`) {
    super(
      message,
      `${source} is receiving too many requests right now. Please try again in a minute.`,
      429,
    );
  }
}

export class SsbTooLargeError extends SsbError {
  constructor(source: string, message: string, status?: number) {
    super(
      message,
      `That question needs more data than ${source} allows in one request. Try narrowing it down, for example to fewer years or regions.`,
      status,
    );
  }
}

export class SsbNotFoundError extends SsbError {
  constructor(source: string, message: string) {
    super(message, `That ${source} table could not be found.`, 404);
  }
}

export class SsbInvalidQueryError extends SsbError {
  constructor(source: string, message: string, status?: number) {
    super(message, `The request to ${source} was not valid.`, status);
  }
}

export class SsbUnavailableError extends SsbError {
  constructor(
    source: string,
    message: string,
    status?: number,
    options?: ErrorOptions,
  ) {
    super(
      message,
      `${source} is temporarily unavailable. Please try again in a few minutes.`,
      status,
      options,
    );
  }
}

// PxWebApi reports an oversized query as 400 "Too many cells selected", not 403.
const TOO_MANY_CELLS = /too many cells/i;

export function toSsbError(
  source: string,
  status: number,
  body: unknown,
): SsbError {
  const problem = problemSchema.safeParse(body);
  const detail = problem.success
    ? [problem.data.title, problem.data.detail].filter(Boolean).join(": ")
    : "no problem details";
  const message = `${source} responded ${status}: ${detail}`;

  if (status === 429) return new SsbRateLimitError(source, message);
  if (status === 404) return new SsbNotFoundError(source, message);
  if (status === 403) return new SsbTooLargeError(source, message, status);
  if (
    status === 400 &&
    problem.success &&
    TOO_MANY_CELLS.test(problem.data.title)
  ) {
    return new SsbTooLargeError(source, message, status);
  }
  if (status >= 400 && status < 500) {
    return new SsbInvalidQueryError(source, message, status);
  }
  return new SsbUnavailableError(source, message, status);
}

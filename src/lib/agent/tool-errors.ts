import {
  SsbError,
  SsbInvalidQueryError,
  SsbNotFoundError,
  SsbTooLargeError,
} from "@/lib/ssb";

// The model only sees error.message, so it has to say whether a retry can help.
// Outages get a hard stop: retrying burns the step limit and the shared
// 30 requests/minute, and an answer without data must not be invented.
export function toToolError(error: unknown, source: string): unknown {
  if (!(error instanceof SsbError)) return error;

  if (error instanceof SsbTooLargeError) {
    return new Error(
      `${error.message}. Select fewer values (fewer periods, regions or categories) and try again.`,
    );
  }
  if (error instanceof SsbNotFoundError) {
    return new Error(
      `${error.message}. Use a table id returned by searchTables, or search again.`,
    );
  }
  if (error instanceof SsbInvalidQueryError) {
    return new Error(
      `${error.message}. Check the codes against getTableMetadata and fix the call.`,
    );
  }
  // Rate limit after retries, 5xx, network errors and unexpected responses.
  return new Error(
    `${error.message}. ${source} is not available right now. Do not retry. Stop calling tools and tell the user that ${source} could not be reached and to try again in a few minutes. Do not answer from memory.`,
  );
}

export async function withToolErrors<T>(
  source: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toToolError(error, source);
  }
}

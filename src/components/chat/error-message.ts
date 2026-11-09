// useChat puts the raw response body in error.message, so a JSON error from
// the chat route would otherwise show up as {"error":"..."}.
export function errorMessage(error: Error): string {
  try {
    const body: unknown = JSON.parse(error.message);
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      return body.error;
    }
  } catch {
    // Not JSON: already a readable message.
  }
  return error.message;
}

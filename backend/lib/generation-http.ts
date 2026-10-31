import { MAX_GENERATION_BODY_BYTES } from "./planning-limits.ts";

export class RequestProblem extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function readJsonBody(
  request: Request,
  timeoutMs: number,
): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_GENERATION_BODY_BYTES
  ) {
    throw new RequestProblem(
      "The event brief is too large. Shorten the notes and try again.",
      413,
    );
  }
  if (request.bodyUsed || request.body?.locked) {
    throw new RequestProblem(
      "The event brief could not be read. Please try again.",
      400,
    );
  }
  if (!request.body)
    throw new RequestProblem(
      "Add an event brief before generating a plan.",
      400,
    );

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let byteCount = 0;
  let finished = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () =>
      reject(
        new RequestProblem(
          "The event brief upload was cancelled. Please try again.",
          408,
        ),
      );
    if (request.signal.aborted) onAbort();
    else request.signal.addEventListener("abort", onAbort, { once: true });
    timeout = setTimeout(
      () =>
        reject(
          new RequestProblem(
            "The event brief took too long to upload. Please try again.",
            408,
          ),
        ),
      timeoutMs,
    );
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), interrupted]);
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > MAX_GENERATION_BODY_BYTES) {
        throw new RequestProblem(
          "The event brief is too large. Shorten the notes and try again.",
          413,
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    finished = true;
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof RequestProblem) throw error;
    throw new RequestProblem(
      "The event brief could not be read. Please try again.",
      400,
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", onAbort);
    // Cancellation must not wait on an uncooperative stream source's cancel callback.
    if (!finished) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...Object.fromEntries(new Headers(headers)),
    },
  });
}

export function providerFailure(error: unknown): {
  status: number;
  code: string;
  message: string;
} {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? error.status
      : undefined;
  const errorName =
    error instanceof Error
      ? error.name === "Error"
        ? error.constructor.name
        : error.name
      : "";

  if (status === 429 || errorName === "RateLimitError") {
    return {
      status: 503,
      code: "PROVIDER_RATE_LIMITED",
      message:
        "The planning service is temporarily busy. Please try again later.",
    };
  }
  if (
    errorName === "APIConnectionTimeoutError" ||
    errorName === "TimeoutError" ||
    errorName === "AbortError"
  ) {
    return {
      status: 504,
      code: "PROVIDER_TIMEOUT",
      message:
        "The planning service took too long to respond. Your brief is unchanged; please try again.",
    };
  }
  return {
    status: 502,
    code: "PROVIDER_FAILED",
    message:
      "The planning service could not create a draft. Your brief is unchanged; please try again.",
  };
}

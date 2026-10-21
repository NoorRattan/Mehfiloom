import { ZodError } from "zod";
import {
  buildPlanResult,
  generationRequestSchema,
  parseBudgetMinor,
  type PlannerProposal,
} from "./planner.ts";

const MAX_BODY_BYTES = 16 * 1024;
const WINDOW_MS = 20 * 60 * 1000;
const MAX_CALLS_PER_WINDOW = 4;
const MAX_TRACKED_CLIENTS = 2000;

class RequestProblem extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type GenerationLimiter = (request: Request) => boolean;

export function createInMemoryGenerationLimiter(
  now: () => number = Date.now,
): GenerationLimiter {
  const callsByClient = new Map<string, { count: number; resetAt: number }>();

  return function takeGenerationSlot(request: Request): boolean {
    // These headers are safe to use only when the hosting proxy overwrites them.
    // This per-process limit is a backstop for local/single-instance runs, not a deployment quota.
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const clientKey = (forwarded || request.headers.get("x-real-ip") || "local").slice(0, 64);
    const currentTime = now();
    const current = callsByClient.get(clientKey);

    if (callsByClient.size >= MAX_TRACKED_CLIENTS && !current) {
      for (const [key, entry] of callsByClient) {
        if (entry.resetAt <= currentTime) callsByClient.delete(key);
      }
      if (callsByClient.size >= MAX_TRACKED_CLIENTS) return false;
    }

    if (!current || current.resetAt <= currentTime) {
      callsByClient.set(clientKey, { count: 1, resetAt: currentTime + WINDOW_MS });
      return true;
    }
    if (current.count >= MAX_CALLS_PER_WINDOW) return false;
    current.count += 1;
    return true;
  };
}

async function readJsonBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new RequestProblem("The event brief is too large. Shorten the notes and try again.", 413);
  }
  if (!request.body) throw new RequestProblem("Add an event brief before generating a plan.", 400);

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let byteCount = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteCount += value.byteLength;
    if (byteCount > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RequestProblem("The event brief is too large. Shorten the notes and try again.", 413);
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RequestProblem("The event brief could not be read. Please try again.", 400);
  }
}

function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...Object.fromEntries(new Headers(headers)) },
  });
}

export function createGenerationEndpoint(options: {
  hasProviderKey: () => boolean;
  generate: (input: unknown) => Promise<PlannerProposal>;
  allowRequest: GenerationLimiter;
}) {
  return async function handleGenerationRequest(request: Request): Promise<Response> {
    try {
      const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
      if (request.body && contentType !== "application/json") {
        throw new RequestProblem("Send the event brief as JSON.", 415);
      }
      const input = await readJsonBody(request);
      const parsed = generationRequestSchema.safeParse(input);
      if (!parsed.success) {
        return jsonResponse(
          { error: { message: parsed.error.issues[0]?.message ?? "Check the event brief and try again." } },
          400,
        );
      }

      const { brief } = parsed.data;
      const revisionRequest = "revisionRequest" in parsed.data ? parsed.data.revisionRequest : undefined;

      let totalMinor: number;
      try {
        totalMinor = parseBudgetMinor(brief.budgetAmount, brief.currency);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Check the budget amount and currency.";
        return jsonResponse({ error: { message } }, 400);
      }

      if (!options.hasProviderKey()) {
        return jsonResponse(
          { error: { code: "PROVIDER_NOT_CONFIGURED", message: "AI planning is not connected yet. Add a Groq API key to the server environment to generate a live plan." } },
          503,
        );
      }
      if (!options.allowRequest(request)) {
        return jsonResponse(
          { error: { code: "RATE_LIMITED", message: "This app instance has reached its short-term generation limit. Please try again later." } },
          429,
          { "Retry-After": String(WINDOW_MS / 1000) },
        );
      }

      const proposal = await options.generate(revisionRequest ? { brief, revisionRequest } : brief);
      const result = buildPlanResult(proposal, brief.currency, totalMinor);
      return jsonResponse({ result });
    } catch (error) {
      if (error instanceof RequestProblem) {
        return jsonResponse({ error: { message: error.message } }, error.status);
      }
      if (error instanceof ZodError) {
        return jsonResponse(
          { error: { message: "The planning service returned a draft that did not meet the required structure. Your brief is unchanged; try again." } },
          502,
        );
      }

      return jsonResponse(
        { error: { message: "The planning service could not create a draft. Your brief is unchanged; please try again." } },
        502,
      );
    }
  };
}

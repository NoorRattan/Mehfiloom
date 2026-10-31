import { ZodError } from "zod";
import {
  buildPlanResult,
  generationRequestSchema,
  parseBudgetMinor,
  validateProposalForBrief,
  type PlannerProposal,
} from "./planner.ts";

import {
  GENERATION_WINDOW_MS,
  type GenerationLimiter,
} from "./generation-admission.ts";
import {
  RequestProblem,
  readJsonBody,
  jsonResponse,
  providerFailure,
} from "./generation-http.ts";
export {
  createInMemoryGenerationLimiter,
  type GenerationLimiter,
} from "./generation-admission.ts";

const BODY_TIMEOUT_MS = 5_000;

export function createGenerationEndpoint(options: {
  hasProviderKey: () => boolean;
  generate: (
    input: unknown,
    options?: { signal?: AbortSignal },
  ) => Promise<PlannerProposal>;
  allowRequest: GenerationLimiter;
  bodyTimeoutMs?: number;
}) {
  return async function handleGenerationRequest(
    request: Request,
  ): Promise<Response> {
    try {
      const contentType = request.headers
        .get("content-type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase();
      if (request.body && contentType !== "application/json") {
        throw new RequestProblem("Send the event brief as JSON.", 415);
      }
      // Admission precedes body parsing and expensive date/time refinements.
      // Malformed JSON attempts also consume this bounded ingress allowance.
      if (!options.allowRequest(request)) {
        return jsonResponse(
          {
            error: {
              code: "RATE_LIMITED",
              message:
                "This app instance has reached its short-term request limit. Please try again later.",
            },
          },
          429,
          { "Retry-After": String(GENERATION_WINDOW_MS / 1000) },
        );
      }
      const input = await readJsonBody(
        request,
        options.bodyTimeoutMs ?? BODY_TIMEOUT_MS,
      );
      const parsed = generationRequestSchema.safeParse(input);
      if (!parsed.success) {
        return jsonResponse(
          {
            error: {
              message:
                parsed.error.issues[0]?.message ??
                "Check the event brief and try again.",
            },
          },
          400,
        );
      }

      const { brief } = parsed.data;
      let totalMinor: number;
      try {
        totalMinor = parseBudgetMinor(brief.budgetAmount, brief.currency);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Check the budget amount and currency.";
        return jsonResponse({ error: { message } }, 400);
      }

      if (!options.hasProviderKey()) {
        return jsonResponse(
          {
            error: {
              code: "PROVIDER_NOT_CONFIGURED",
              message:
                "AI planning is not connected yet. Add a Groq API key to the server environment to generate a live plan.",
            },
          },
          503,
        );
      }

      // The generator accepts a raw brief for first drafts and the validated wrapper for revisions.
      // Preserve the full wrapper in revision calls so accepted host constraints reach the model.
      const providerInput =
        "revisionRequest" in parsed.data ? parsed.data : brief;
      if (request.signal.aborted) {
        throw new RequestProblem(
          "The planning request was cancelled. Please try again.",
          408,
        );
      }
      const generated = await options.generate(providerInput, {
        signal: request.signal,
      });
      if (request.signal.aborted) {
        throw new RequestProblem(
          "The planning request was cancelled. Please try again.",
          408,
        );
      }
      const proposal = validateProposalForBrief(generated, brief);
      const result = buildPlanResult(proposal, brief.currency, totalMinor);
      return jsonResponse({ result });
    } catch (error) {
      if (error instanceof RequestProblem) {
        return jsonResponse(
          { error: { message: error.message } },
          error.status,
        );
      }
      if (error instanceof ZodError) {
        return jsonResponse(
          {
            error: {
              message:
                "The planning service returned a draft that did not meet the required structure. Your brief is unchanged; try again.",
            },
          },
          502,
        );
      }

      const failure = providerFailure(error);
      const providerStatus =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof error.status === "number"
          ? error.status
          : undefined;
      console.error("Planning provider request failed", {
        name: error instanceof Error ? error.name : "UnknownError",
        providerStatus,
        incompleteResponse:
          error instanceof Error &&
          error.message === "INCOMPLETE_MODEL_RESPONSE",
      });
      return jsonResponse(
        { error: { code: failure.code, message: failure.message } },
        failure.status,
      );
    }
  };
}

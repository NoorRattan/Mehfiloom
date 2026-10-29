import type { PlanResult } from "@/lib/planner";
import { planResultSchema } from "./workspace-store";

/** Validate the HTTP boundary before any provider data reaches a saved draft. */
export async function readGenerationResponse(response: Response): Promise<PlanResult> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("The planning service returned an unreadable response. Your draft is safe; please try again.");
  }
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "error" in body
      && typeof body.error === "object" && body.error !== null && "message" in body.error
      && typeof body.error.message === "string" && body.error.message.trim()
      ? body.error.message
      : "We couldn’t create your plan. Please try again.";
    throw new Error(message);
  }
  const result = planResultSchema.safeParse(
    typeof body === "object" && body !== null && "result" in body ? body.result : undefined,
  );
  if (!result.success) {
    throw new Error("The planning service returned an incomplete plan. Please try again.");
  }
  return result.data;
}

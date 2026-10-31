import { z } from "zod";
import {
  eventBriefSchema,
  currencySchema,
  buildPlanResult,
  BUDGET_CATEGORIES,
  proposalSchema,
  type EventBrief,
  type PlanResult,
} from "@/lib/planner";
import type { EventKind } from "./events";
import {
  MAX_BUDGET_MINOR,
  MAX_CUSTOM_TASKS,
  MAX_DRAFT_CHARACTERS,
  MAX_REVISION_REQUESTS,
  MAX_REVISION_REQUEST_CHARACTERS,
} from "../../backend/lib/planning-limits";

export const planResultSchema = z
  .object({
    proposal: proposalSchema,
    currency: currencySchema,
    totalMinor: z.number().int().positive().max(MAX_BUDGET_MINOR),
    allocatedMinor: z.number().int().nonnegative().max(MAX_BUDGET_MINOR),
    lines: z
      .array(
        z
          .object({
            category: z.enum(BUDGET_CATEGORIES),
            weight: z.number().int().min(1).max(1000),
            rationale: z.string().trim().min(10).max(180),
            amountMinor: z.number().int().nonnegative().max(MAX_BUDGET_MINOR),
          })
          .strict(),
      )
      .min(4)
      .max(8),
  })
  .strict()
  .refine(
    (result) =>
      result.allocatedMinor === result.totalMinor &&
      result.lines.reduce((sum, line) => sum + line.amountMinor, 0) ===
        result.totalMinor,
    "The budget allocation does not reconcile.",
  )
  .refine((result) => {
    try {
      // Validate proposal categories and reserve, while retaining host-edited amounts.
      const expected = buildPlanResult(
        result.proposal,
        result.currency,
        result.totalMinor,
      );
      const lines = new Map(result.lines.map((line) => [line.category, line]));
      return (
        lines.size === result.lines.length &&
        lines.size === expected.lines.length &&
        expected.lines.every((line) => {
          const saved = lines.get(line.category);
          return (
            saved?.weight === line.weight && saved.rationale === line.rationale
          );
        })
      );
    } catch {
      return false;
    }
  }, "Budget lines must match the proposal categories and include a reserve.");
const savedSchema = z.object({
  // Submission refinements belong at generation time. A controlled draft must
  // also retain temporary values while a host edits a date or guest estimate.
  brief: z
    .object({
      ...eventBriefSchema.shape,
      eventName: z.string().max(80),
      location: z.string().max(100),
      guestCount: z.number().min(-1_000_000_000).max(1_000_000_000),
      eventDate: z.string().max(10),
      timeZone: z.string().max(100).nullable().default(null),
      eventTime: z.string().max(5).default(""),
      budgetAmount: z.string().max(24),
      // A draft must retain spaces while the host is still typing a sentence.
      style: z.string().max(500),
      mustHaves: z.string().max(700),
    })
    .strict(),
  checked: z.array(z.string().max(120)),
  customTasks: z.array(z.string().min(1).max(120)).max(MAX_CUSTOM_TASKS),
  vendorNotes: z.record(z.string().max(60), z.string().max(1000)),
  // Recover a damaged generated result without discarding host-entered work.
  result: planResultSchema.nullable().catch(null),
  resultSource: z.enum(["starter", "ai"]).nullable(),
  revisionRequests: z
    .array(z.string().max(MAX_REVISION_REQUEST_CHARACTERS))
    .max(MAX_REVISION_REQUESTS),
});
export type Workspace = {
  brief: EventBrief;
  checked: string[];
  customTasks: string[];
  vendorNotes: Record<string, string>;
  result: PlanResult | null;
  resultSource: "starter" | "ai" | null;
  revisionRequests: string[];
};

export function parseDraft(
  raw: string | null,
  kind: EventKind,
  fallback: Workspace,
): Workspace {
  if (!raw || raw.length > MAX_DRAFT_CHARACTERS) return fallback;
  try {
    const parsed = savedSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.brief.eventType !== kind)
      return fallback;
    const state = parsed.data;
    return {
      ...state,
      resultSource: state.result ? state.resultSource : null,
    };
  } catch {
    return fallback;
  }
}

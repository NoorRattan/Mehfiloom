import { z } from "zod";
import { currencySchema, currencyDigits } from "./planner-money.ts";
import {
  MAX_BUDGET_MINOR,
  MAX_REVISION_REQUESTS,
  MAX_REVISION_REQUEST_CHARACTERS,
} from "./planning-limits.ts";
export {
  currencySchema,
  currencyDigits,
  formatMoney,
  isSupportedCurrency,
  parseBudgetMinor,
} from "./planner-money.ts";
export {
  EXAMPLE_BRIEF,
  EXAMPLE_PROPOSAL,
  EVENT_TEMPLATE_PROPOSALS,
  getEventTemplateProposal,
  exampleBriefForEvent,
} from "./planner-templates.ts";
import {
  isValidIanaTimeZone,
  resolveZonedDateTime,
  type TimeOccurrence,
} from "./schedule.ts";

export const EVENT_TYPES = ["wedding", "birthday", "community"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const BUDGET_CATEGORIES = [
  "venue",
  "food",
  "decor",
  "attire",
  "photography",
  "entertainment",
  "logistics",
  "accessibility",
  "contingency",
  "other",
] as const;

export const CATEGORY_LABELS: Record<
  (typeof BUDGET_CATEGORIES)[number],
  string
> = {
  venue: "Venue",
  food: "Food & drinks",
  decor: "Decor",
  attire: "Attire",
  photography: "Photography",
  entertainment: "Entertainment",
  logistics: "Logistics",
  accessibility: "Access & safety",
  contingency: "Reserve",
  other: "Other needs",
};

export const proposalSchema = z
  .object({
    conceptTitle: z.string().trim().min(3).max(80),
    overview: z.string().trim().min(30).max(500),
    theme: z.string().trim().min(3).max(100),
    budgetAllocations: z
      .array(
        z
          .object({
            category: z.enum(BUDGET_CATEGORIES),
            weight: z.number().int().min(1).max(1000),
            rationale: z.string().trim().min(10).max(180),
          })
          .strict(),
      )
      .min(4)
      .max(8),
    timeline: z
      .array(
        z
          .object({
            task: z.string().trim().min(5).max(120),
            timing: z.string().trim().min(3).max(80),
            priority: z.enum(["high", "medium", "low"]),
            sessionId: z
              .string()
              .min(3)
              .max(100)
              .regex(/^[A-Za-z0-9:_-]+$/)
              .nullable()
              .optional(),
          })
          .strict(),
      )
      .min(6)
      .max(12),
    vendorChecklist: z
      .array(
        z
          .object({
            category: z.string().trim().min(3).max(60),
            questions: z.array(z.string().trim().min(5).max(150)).min(3).max(6),
          })
          .strict(),
      )
      .min(3)
      .max(6),
    ideas: z
      .array(
        z
          .object({
            title: z.string().trim().min(3).max(80),
            whyItFits: z.string().trim().min(10).max(180),
            costNote: z.string().trim().min(5).max(160),
          })
          .strict(),
      )
      .min(3)
      .max(5),
    openQuestions: z.array(z.string().trim().min(8).max(150)).min(2).max(5),
    assumptions: z.array(z.string().trim().min(8).max(150)).min(2).max(5),
  })
  .strict();

export type PlannerProposal = z.infer<typeof proposalSchema>;

export const proposalJsonSchema = Object.fromEntries(
  Object.entries(z.toJSONSchema(proposalSchema, { target: "draft-7" })).filter(
    ([key]) => key !== "~standard" && key !== "$schema",
  ),
);

export const eventBriefSchema = z
  .object({
    eventType: z.enum(EVENT_TYPES),
    eventName: z.string().trim().min(2).max(80),
    location: z.string().trim().min(2).max(100),
    eventDate: z
      .string()
      .refine(
        (value) =>
          value === "" ||
          (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
            !Number.isNaN(Date.parse(`${value}T12:00:00Z`))),
        "Enter a valid event date.",
      )
      .refine(isValidCalendarDate, "Enter a valid event date."),
    timeZone: z.string().trim().min(1).max(100).nullable().default(null),
    eventTime: z
      .string()
      .regex(/^(?:|(?:[01]\d|2[0-3]):[0-5]\d)$/)
      .default(""),
    eventTimeOccurrence: z.enum(["earlier", "later"]).nullable().default(null),
    guestCount: z.number().int().min(1).max(10000),
    sessions: z
      .array(
        z
          .object({
            id: z
              .string()
              .min(3)
              .max(100)
              .regex(/^[A-Za-z0-9:_-]+$/),
            name: z.string().trim().min(2).max(80),
            date: z
              .string()
              .refine(isValidCalendarDate, "Enter a valid session date."),
            startTime: z
              .string()
              .regex(/^(?:|(?:[01]\d|2[0-3]):[0-5]\d)$/)
              .default(""),
            startTimeOccurrence: z
              .enum(["earlier", "later"])
              .nullable()
              .default(null),
            guestCount: z.number().int().min(1).max(10000),
          })
          .strict(),
      )
      .max(12)
      .default([]),
    budgetAmount: z.string().trim().min(1).max(24),
    currency: currencySchema,
    style: z.string().trim().max(500),
    mustHaves: z.string().trim().max(700),
  })
  .strict()
  .superRefine((brief, context) => {
    if (brief.timeZone !== null && !isValidIanaTimeZone(brief.timeZone)) {
      context.addIssue({
        code: "custom",
        path: ["timeZone"],
        message:
          "Enter a valid IANA time zone, such as Asia/Kolkata or America/New_York.",
      });
    }

    const validateLocalTime = (
      date: string,
      time: string,
      occurrence: TimeOccurrence | null,
      path: (string | number)[],
    ) => {
      if (!time) {
        if (occurrence !== null)
          context.addIssue({
            code: "custom",
            path,
            message:
              "Choose a repeated-time occurrence only when a local time is set.",
          });
        return;
      }
      if (!date) {
        context.addIssue({
          code: "custom",
          path,
          message:
            "Set the event or function date before adding its local start time.",
        });
        return;
      }
      if (!brief.timeZone || !isValidIanaTimeZone(brief.timeZone)) {
        context.addIssue({
          code: "custom",
          path,
          message:
            "Set a valid event time zone before adding a local start time.",
        });
        return;
      }
      const resolution = resolveZonedDateTime(
        date,
        time,
        brief.timeZone,
        occurrence,
      );
      if (resolution.status === "nonexistent") {
        context.addIssue({
          code: "custom",
          path,
          message:
            "This local time does not exist because the clocks move forward in this time zone.",
        });
      } else if (resolution.status === "ambiguous" && occurrence === null) {
        context.addIssue({
          code: "custom",
          path,
          message:
            "This local time occurs twice when clocks move back. Choose the earlier or later occurrence.",
        });
      } else if (resolution.status === "invalid") {
        context.addIssue({
          code: "custom",
          path,
          message: "Check the date, local time, and IANA time zone.",
        });
      } else if (resolution.status === "unique" && occurrence !== null) {
        context.addIssue({
          code: "custom",
          path,
          message:
            "Clear the repeated-time choice because this local time occurs only once.",
        });
      }
    };

    validateLocalTime(
      brief.eventDate,
      brief.eventTime,
      brief.eventTimeOccurrence,
      ["eventTime"],
    );
    brief.sessions.forEach((session, index) => {
      validateLocalTime(
        session.date,
        session.startTime,
        session.startTimeOccurrence,
        ["sessions", index, "startTime"],
      );
    });

    const ids = brief.sessions.map((session) => session.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["sessions"],
        message: "Session IDs must be unique.",
      });
    }
  });

export type EventBrief = z.infer<typeof eventBriefSchema>;

/** Validate references that the proposal's standalone shape cannot establish. */
export function validateProposalForBrief(
  proposal: unknown,
  brief: EventBrief,
): PlannerProposal {
  const parsed = proposalSchema.parse(proposal);
  const sessionIds = new Set(brief.sessions.map((session) => session.id));
  if (
    parsed.timeline.some(
      (task) => task.sessionId != null && !sessionIds.has(task.sessionId),
    )
  ) {
    throw new Error(
      "The plan referred to an unknown event session. Please generate it again.",
    );
  }
  return parsed;
}

export const generationRequestSchema = z.union([
  eventBriefSchema.transform((brief) => ({ brief })),
  z
    .object({
      brief: eventBriefSchema,
      priorRevisionRequests: z
        .array(z.string().trim().min(8).max(MAX_REVISION_REQUEST_CHARACTERS))
        .max(MAX_REVISION_REQUESTS)
        .default([]),
      revisionRequest: z
        .string()
        .trim()
        .min(8)
        .max(MAX_REVISION_REQUEST_CHARACTERS),
    })
    .strict(),
]);

export type GenerationRequest = z.infer<typeof generationRequestSchema>;

export type BudgetLine = PlannerProposal["budgetAllocations"][number] & {
  amountMinor: number;
};

export type PlanResult = {
  proposal: PlannerProposal;
  currency: string;
  totalMinor: number;
  allocatedMinor: number;
  lines: BudgetLine[];
};

function isValidCalendarDate(value: string): boolean {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function buildPlanResult(
  proposal: PlannerProposal,
  currency: string,
  totalMinor: number,
): PlanResult {
  currencyDigits(currency);
  if (
    !Number.isSafeInteger(totalMinor) ||
    totalMinor <= 0 ||
    totalMinor > MAX_BUDGET_MINOR
  ) {
    throw new Error(
      "The plan needs a positive budget within the supported planning range.",
    );
  }

  const categories = proposal.budgetAllocations.map((item) => item.category);
  if (new Set(categories).size !== categories.length) {
    throw new Error(
      "The plan repeated a budget category. Please generate it again.",
    );
  }
  if (!categories.includes("contingency")) {
    throw new Error(
      "The plan omitted a contingency allocation. Please generate it again.",
    );
  }
  if (
    proposal.budgetAllocations.some(
      (item) =>
        !Number.isSafeInteger(item.weight) ||
        item.weight < 1 ||
        item.weight > 1000,
    )
  ) {
    throw new Error("The plan returned invalid budget allocation weights.");
  }

  const weightTotal = proposal.budgetAllocations.reduce(
    (sum, item) => sum + item.weight,
    0,
  );
  if (!Number.isSafeInteger(weightTotal) || weightTotal <= 0) {
    throw new Error("The plan returned invalid budget allocation weights.");
  }

  const total = BigInt(totalMinor);
  const denominator = BigInt(weightTotal);
  const shares = proposal.budgetAllocations.map((item, index) => {
    const product = total * BigInt(item.weight);
    return {
      index,
      amountMinor: Number(product / denominator),
      remainder: product % denominator,
    };
  });

  const floorTotal = shares.reduce(
    (sum, share) => sum + BigInt(share.amountMinor),
    0n,
  );
  const minorUnitsToDistribute = Number(total - floorTotal);
  const byRemainder = [...shares].sort((left, right) => {
    if (left.remainder === right.remainder) return left.index - right.index;
    return left.remainder > right.remainder ? -1 : 1;
  });
  for (let i = 0; i < minorUnitsToDistribute; i += 1) {
    byRemainder[i].amountMinor += 1;
  }

  const lines = proposal.budgetAllocations.map((item, index) => ({
    ...item,
    amountMinor: shares[index].amountMinor,
  }));
  const allocatedMinor = lines.reduce((sum, item) => sum + item.amountMinor, 0);
  if (allocatedMinor !== totalMinor)
    throw new Error("The budget allocation did not reconcile.");

  return { proposal, currency, totalMinor, allocatedMinor, lines };
}

import { z } from "zod";
import { capturePlanContent } from "./plan-content.ts";
import { idSchema, scopedPlanId } from "./plan-record-primitives.ts";
import { taskRecordSchema, type TaskRecord } from "./plan-tasks.ts";
import {
  costItemSchema,
  expectedGuestsForCostItem,
  forecastCostItem,
  safeMinor,
  type CostItem,
} from "./plan-costs.ts";
import {
  MAX_BUDGET_MINOR,
  MAX_REVISION_REQUESTS,
  MAX_REVISION_REQUEST_CHARACTERS,
} from "./planning-limits.ts";
import {
  BUDGET_CATEGORIES,
  buildPlanResult,
  eventBriefSchema,
  parseBudgetMinor,
  proposalSchema,
  validateProposalForBrief,
  type EventBrief,
  type PlannerProposal,
} from "./planner.ts";

// Retain the original domain entrypoint while keeping each concern in its module.
export {
  taskRecordSchema,
  resolveTaskDate,
  canAddTaskDependency,
  canMarkTaskDone,
  canReopenTask,
  taskScheduleConflicts,
} from "./plan-tasks.ts";
export type { TaskRecord, TaskDateResolution } from "./plan-tasks.ts";
export {
  costPaymentSchema,
  costAdjustmentSchema,
  costItemSchema,
  quoteValidityStatus,
  parseCostExclusions,
  evidenceAfterAmountEntry,
  forecastCostItem,
  addCostPayment,
  removeCostPayment,
  expectedGuestsForCostItem,
} from "./plan-costs.ts";
export type {
  CostItem,
  CostPayment,
  CostAdjustment,
  CostItemForecast,
  QuoteValidityStatus,
} from "./plan-costs.ts";

export const WORKSPACE_STORAGE_KEY = "mehfiloom.workspace.v5";
export const LEGACY_WORKSPACE_STORAGE_KEY = "mehfiloom.workspace.v4";
export const OLDER_WORKSPACE_STORAGE_KEY = "mehfiloom.workspace.v3";
export const SECOND_OLDER_WORKSPACE_STORAGE_KEY = "mehfiloom.workspace.v2";
export const OLDEST_WORKSPACE_STORAGE_KEY = "mehfiloom.workspace.v1";
export const WORKSPACE_VERSION = 5;
export const MAX_SAVED_PLANS = 12;
export const MAX_PLAN_DOCUMENT_BYTES = 500_000;
export const MAX_WORKSPACE_BYTES = 2_000_000;

export const vendorRecordSchema = z
  .object({
    id: idSchema,
    category: z.string().trim().min(3).max(60),
    questions: z.array(z.string().trim().min(5).max(150)).min(3).max(6),
    name: z.string().trim().max(80).nullable(),
    availability: z.enum([
      "unknown",
      "inquiry_pending",
      "confirmed",
      "expired",
    ]),
    booking: z.enum(["not_booked", "host_recorded", "cancelled"]),
    checkedAt: z.string().datetime().nullable(),
    notes: z.string().max(500),
  })
  .strict();

const preferenceSchema = z
  .object({
    id: idSchema,
    statement: z.string().trim().min(2).max(700),
    priority: z.enum(["hard", "preference"]),
    source: z.literal("host"),
    confirmed: z.boolean(),
  })
  .strict();

const guestSummarySchema = z
  .object({
    expected: z.number().int().min(1).max(10000),
    confirmed: z.number().int().min(0).max(10000).nullable(),
    adultCount: z.number().int().min(0).max(10000).nullable(),
    childCount: z.number().int().min(0).max(10000).nullable(),
    identitiesStored: z.literal(false),
  })
  .strict();

const sessionAttendanceSchema = z
  .object({
    sessionId: idSchema,
    confirmedGuests: z.number().int().min(0).max(10000).nullable(),
  })
  .strict();

const manualProposalFieldSchema = z.enum(["conceptTitle", "overview", "theme"]);
const revisionHistoryEntrySchema = z
  .object({
    id: idSchema,
    baseRevisionNumber: z.number().int().min(0).max(100),
    revisionNumber: z.number().int().min(1).max(100),
    request: z.string().trim().min(8).max(MAX_REVISION_REQUEST_CHARACTERS),
    acceptedAt: z.string().datetime(),
    changedSections: z.array(z.string().trim().min(2).max(60)).max(12),
    preservedSections: z.array(z.string().trim().min(2).max(80)).max(12),
  })
  .strict();

const budgetSchema = z
  .object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    capMinor: z.number().int().positive().max(MAX_BUDGET_MINOR),
    reviewComplete: z.boolean(),
    items: z.array(costItemSchema).max(100),
  })
  .strict();

const planContentSchema = z
  .object({
    draftBrief: eventBriefSchema,
    planBrief: eventBriefSchema,
    proposal: proposalSchema,
    origin: z.enum(["example", "ai"]),
    edited: z.boolean(),
    manualProposalFields: z.array(manualProposalFieldSchema).max(3).default([]),
    manualTaskIds: z.array(idSchema).max(40).default([]),
    budget: budgetSchema,
    guestSummary: guestSummarySchema,
    sessionAttendance: z.array(sessionAttendanceSchema).max(12).default([]),
    preferences: z.array(preferenceSchema).max(30),
    tasks: z.array(taskRecordSchema).min(1).max(40),
    vendors: z.array(vendorRecordSchema).max(30),
  })
  .strict();

const undoRevisionSchema = z
  .object({
    acceptedAt: z.string().datetime(),
    revisionNumber: z.number().int().min(1).max(100),
    snapshot: planContentSchema,
  })
  .strict();

const savedPlanBaseSchema = z
  .object({
    schemaVersion: z.literal(WORKSPACE_VERSION),
    id: idSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    revisionNumber: z.number().int().min(0).max(100).default(0),
    revisionHistory: z
      .array(revisionHistoryEntrySchema)
      .max(MAX_REVISION_REQUESTS)
      .default([]),
    undoRevision: undoRevisionSchema.nullable().default(null),
    ...planContentSchema.shape,
  })
  .strict()
  .superRefine((plan, context) => {
    const unique = (items: { id: string }[], path: string) => {
      const seen = new Set<string>();
      items.forEach((item, index) => {
        if (seen.has(item.id))
          context.addIssue({
            code: "custom",
            path: [path, index, "id"],
            message: "IDs must be unique within a plan.",
          });
        seen.add(item.id);
      });
    };

    unique(plan.tasks, "tasks");
    unique(plan.vendors, "vendors");
    unique(plan.budget.items, "budget.items");
    unique(plan.preferences, "preferences");

    const sessionIds = new Set(
      plan.planBrief.sessions.map((session) => session.id),
    );
    const attendanceIds = plan.sessionAttendance.map(
      (attendance) => attendance.sessionId,
    );
    if (new Set(attendanceIds).size !== attendanceIds.length) {
      context.addIssue({
        code: "custom",
        path: ["sessionAttendance"],
        message: "Session attendance entries must be unique.",
      });
    }
    if (
      attendanceIds.length !== sessionIds.size ||
      attendanceIds.some((sessionId) => !sessionIds.has(sessionId))
    ) {
      context.addIssue({
        code: "custom",
        path: ["sessionAttendance"],
        message: "Each planned session must have one attendance record.",
      });
    }

    const taskIds = new Set(plan.tasks.map((task) => task.id));
    if (
      new Set(plan.manualTaskIds).size !== plan.manualTaskIds.length ||
      plan.manualTaskIds.some((taskId) => !taskIds.has(taskId))
    ) {
      context.addIssue({
        code: "custom",
        path: ["manualTaskIds"],
        message:
          "Manually edited task IDs must be unique and reference tasks in this plan.",
      });
    }
    let dependencyCycleFound = false;
    const dependencyVisitState = new Map<string, "visiting" | "visited">();
    const visitDependencies = (taskId: string): void => {
      if (dependencyVisitState.get(taskId) === "visited") return;
      if (dependencyVisitState.get(taskId) === "visiting") {
        dependencyCycleFound = true;
        return;
      }

      dependencyVisitState.set(taskId, "visiting");
      const task = plan.tasks.find((item) => item.id === taskId);
      for (const dependencyId of task?.dependencyIds ?? []) {
        if (taskIds.has(dependencyId)) visitDependencies(dependencyId);
      }
      dependencyVisitState.set(taskId, "visited");
    };

    plan.tasks.forEach((task, index) => {
      if (task.sessionId && !sessionIds.has(task.sessionId)) {
        context.addIssue({
          code: "custom",
          path: ["tasks", index, "sessionId"],
          message: "Tasks must reference a session in this plan.",
        });
      }
      if (new Set(task.dependencyIds).size !== task.dependencyIds.length) {
        context.addIssue({
          code: "custom",
          path: ["tasks", index, "dependencyIds"],
          message: "A task cannot list the same prerequisite more than once.",
        });
      }
      for (const dependencyId of task.dependencyIds) {
        if (!taskIds.has(dependencyId)) {
          context.addIssue({
            code: "custom",
            path: ["tasks", index, "dependencyIds"],
            message: "Task dependencies must reference a task in this plan.",
          });
        }
      }
    });

    for (const task of plan.tasks) visitDependencies(task.id);
    if (dependencyCycleFound) {
      context.addIssue({
        code: "custom",
        path: ["tasks"],
        message: "Task dependencies cannot contain a cycle.",
      });
    }

    const vendorIds = new Set(plan.vendors.map((vendor) => vendor.id));
    let forecastMaximumWithReserveMinor = BigInt(plan.budget.capMinor);
    plan.budget.items.forEach((item, index) => {
      if (item.sessionId && !sessionIds.has(item.sessionId)) {
        context.addIssue({
          code: "custom",
          path: ["budget", "items", index, "sessionId"],
          message: "Costs must reference a session in this plan.",
        });
      }
      if (item.vendorId && !vendorIds.has(item.vendorId)) {
        context.addIssue({
          code: "custom",
          path: ["budget", "items", index, "vendorId"],
          message: "Cost items must reference a vendor in this plan.",
        });
      }
      try {
        // Validation and the budget UI share the same exact forecast arithmetic.
        const forecast = forecastCostItem(
          item,
          expectedGuestsForCostItem(plan, item),
        );
        forecastMaximumWithReserveMinor += BigInt(forecast.upperMinor ?? 0);
        if (BigInt(item.paidMinor) > BigInt(forecast.lowerMinor ?? 0)) {
          context.addIssue({
            code: "custom",
            path: ["budget", "items", index, "paidMinor"],
            message:
              "Paid amount cannot exceed the commitment total after discounts, fees, and taxes.",
          });
        }
      } catch (error) {
        context.addIssue({
          code: "custom",
          path: ["budget", "items", index, "adjustments"],
          message:
            error instanceof Error
              ? error.message
              : "This cost could not be forecast exactly.",
        });
      }
    });
    if (forecastMaximumWithReserveMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
      context.addIssue({
        code: "custom",
        path: ["budget", "items"],
        message: "Combined cost forecasts exceed the supported exact range.",
      });
    }

    if (plan.budget.currency !== plan.planBrief.currency) {
      context.addIssue({
        code: "custom",
        path: ["budget", "currency"],
        message: "Budget and event currencies must match.",
      });
    }
    if (plan.guestSummary.expected !== plan.planBrief.guestCount) {
      context.addIssue({
        code: "custom",
        path: ["guestSummary", "expected"],
        message: "Expected guests must match the event brief snapshot.",
      });
    }
  });

function migrateBudgetPaymentHistory(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return value;
  const budget = value as Record<string, unknown>;
  if (!Array.isArray(budget.items)) return value;
  return {
    ...budget,
    items: budget.items.map((rawItem) => {
      if (
        typeof rawItem !== "object" ||
        rawItem === null ||
        Array.isArray(rawItem)
      )
        return rawItem;
      const item = rawItem as Record<string, unknown>;
      if ("payments" in item) return item;
      const paidMinor =
        typeof item.paidMinor === "number" &&
        Number.isSafeInteger(item.paidMinor) &&
        item.paidMinor > 0
          ? item.paidMinor
          : 0;
      return {
        ...item,
        payments:
          paidMinor > 0
            ? [
                {
                  id: "legacy-payment-1",
                  amountMinor: paidMinor,
                  paidAt: null,
                  note: "Existing total; payment date not recorded.",
                },
              ]
            : [],
      };
    }),
  };
}

function migrateSavedPlanMetadata(input: unknown): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return input;
  const plan = input as Record<string, unknown>;
  const migrated = { ...plan };
  if (
    typeof migrated.schemaVersion === "number" &&
    migrated.schemaVersion < WORKSPACE_VERSION
  )
    migrated.schemaVersion = WORKSPACE_VERSION;
  if (!("revisionNumber" in migrated)) migrated.revisionNumber = 0;
  if (!("revisionHistory" in migrated)) migrated.revisionHistory = [];
  if (!("undoRevision" in migrated)) migrated.undoRevision = null;
  if (!("manualProposalFields" in migrated)) {
    migrated.manualProposalFields =
      migrated.edited === true ? ["conceptTitle", "overview", "theme"] : [];
  }
  if (!("manualTaskIds" in migrated)) {
    migrated.manualTaskIds =
      migrated.edited === true && Array.isArray(migrated.tasks)
        ? migrated.tasks.flatMap((task) =>
            typeof task === "object" &&
            task !== null &&
            "id" in task &&
            typeof task.id === "string"
              ? [task.id]
              : [],
          )
        : [];
  }
  if (!("sessionAttendance" in migrated)) {
    const planBrief = migrated.planBrief as
      { sessions?: Array<{ id?: unknown }> } | undefined;
    migrated.sessionAttendance = Array.isArray(planBrief?.sessions)
      ? planBrief.sessions.flatMap((session) =>
          typeof session.id === "string"
            ? [{ sessionId: session.id, confirmedGuests: null }]
            : [],
        )
      : [];
  }
  migrated.budget = migrateBudgetPaymentHistory(migrated.budget);
  const undoRevision = migrated.undoRevision;
  if (
    typeof undoRevision === "object" &&
    undoRevision !== null &&
    !Array.isArray(undoRevision)
  ) {
    const undoRecord = undoRevision as Record<string, unknown>;
    const snapshot = undoRecord.snapshot;
    if (
      typeof snapshot === "object" &&
      snapshot !== null &&
      !Array.isArray(snapshot)
    ) {
      const snapshotRecord = snapshot as Record<string, unknown>;
      migrated.undoRevision = {
        ...undoRecord,
        snapshot: {
          ...snapshotRecord,
          budget: migrateBudgetPaymentHistory(snapshotRecord.budget),
        },
      };
    }
  }
  return migrated;
}

export const savedPlanSchema = z.preprocess(
  migrateSavedPlanMetadata,
  savedPlanBaseSchema,
);

export type VendorRecord = z.infer<typeof vendorRecordSchema>;
export type SavedPlan = z.infer<typeof savedPlanSchema>;

const workspaceBaseSchema = z
  .object({
    format: z.literal("mehfiloom-workspace"),
    schemaVersion: z.literal(WORKSPACE_VERSION),
    activePlanId: idSchema,
    plans: z.array(savedPlanSchema).min(1).max(MAX_SAVED_PLANS),
  })
  .strict()
  .superRefine((workspace, context) => {
    const ids = workspace.plans.map((plan) => plan.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["plans"],
        message: "Saved plan IDs must be unique.",
      });
    }
    if (!ids.includes(workspace.activePlanId)) {
      context.addIssue({
        code: "custom",
        path: ["activePlanId"],
        message: "The selected plan must exist in this workspace.",
      });
    }
  });

export const workspaceSchema = z.preprocess((input) => {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return input;
  const workspace = input as Record<string, unknown>;
  return typeof workspace.schemaVersion === "number" &&
    workspace.schemaVersion < WORKSPACE_VERSION
    ? { ...workspace, schemaVersion: WORKSPACE_VERSION }
    : input;
}, workspaceBaseSchema);

export type Workspace = z.infer<typeof workspaceSchema>;

const planDocumentBaseSchema = z
  .object({
    format: z.literal("mehfiloom-plan"),
    schemaVersion: z.literal(WORKSPACE_VERSION),
    plan: savedPlanSchema,
  })
  .strict();

export const planDocumentSchema = z.preprocess((input) => {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return input;
  const document = input as Record<string, unknown>;
  return typeof document.schemaVersion === "number" &&
    document.schemaVersion < WORKSPACE_VERSION
    ? { ...document, schemaVersion: WORKSPACE_VERSION }
    : input;
}, planDocumentBaseSchema);

function categoryForVendor(
  category: string,
): (typeof BUDGET_CATEGORIES)[number] {
  const text = category.toLowerCase();
  if (text.includes("venue")) return "venue";
  if (text.includes("cater") || text.includes("food")) return "food";
  if (text.includes("photo")) return "photography";
  if (text.includes("access")) return "accessibility";
  if (text.includes("decor")) return "decor";
  if (text.includes("music") || text.includes("entertain"))
    return "entertainment";
  return "other";
}

export function createSavedPlan(
  draftBrief: EventBrief,
  planBrief: EventBrief,
  proposal: PlannerProposal,
  id = globalThis.crypto.randomUUID(),
  now = new Date().toISOString(),
  origin: "example" | "ai" = "example",
): SavedPlan {
  const parsedDraft = eventBriefSchema.parse(draftBrief);
  const parsedPlanBrief = eventBriefSchema.parse(planBrief);
  const parsedProposal = proposalSchema.parse(proposal);
  const capMinor = parseBudgetMinor(
    parsedPlanBrief.budgetAmount,
    parsedPlanBrief.currency,
  );
  buildPlanResult(parsedProposal, parsedPlanBrief.currency, capMinor);

  const vendors: VendorRecord[] = parsedProposal.vendorChecklist.map(
    (vendor, index) => ({
      id: scopedPlanId(id, `:vendor:${index + 1}`),
      category: vendor.category,
      questions: vendor.questions,
      name: null,
      availability: "unknown",
      booking: "not_booked",
      checkedAt: null,
      notes: "",
    }),
  );
  const tasks: TaskRecord[] = parsedProposal.timeline.map((task, index) => ({
    id: scopedPlanId(id, `:task:${index + 1}`),
    title: task.task,
    timing: task.timing,
    priority: task.priority,
    status: "todo",
    ownerLabel: "Host",
    dueDate: null,
    relativeOffsetDays: null,
    dependencyIds: [],
    sessionId: task.sessionId ?? null,
  }));
  const costItems: CostItem[] = vendors.map((vendor, index) => ({
    id: scopedPlanId(id, `:cost:${index + 1}`),
    label: `${vendor.category} cost to confirm`,
    category: categoryForVendor(vendor.category),
    vendorId: vendor.id,
    sessionId: null,
    amountMinor: null,
    amountMaxMinor: null,
    pricingModel: "fixed",
    evidence: "unpriced",
    paidMinor: 0,
    payments: [],
    mandatory: false,
    validUntil: null,
    minimumGuestCount: null,
    feesIncluded: null,
    taxesIncluded: null,
    chargesReviewed: false,
    adjustments: [],
    exclusions: [],
    sourceNote: "No quote or local price has been supplied.",
  }));
  const preferences = [
    ...(parsedPlanBrief.mustHaves
      ? [
          {
            id: scopedPlanId(id, ":preference:must-haves"),
            statement: parsedPlanBrief.mustHaves,
            priority: "hard" as const,
            source: "host" as const,
            confirmed: true,
          },
        ]
      : []),
    ...(parsedPlanBrief.style
      ? [
          {
            id: scopedPlanId(id, ":preference:style"),
            statement: parsedPlanBrief.style,
            priority: "preference" as const,
            source: "host" as const,
            confirmed: true,
          },
        ]
      : []),
  ];

  return validateSavedPlan({
    schemaVersion: WORKSPACE_VERSION,
    id,
    createdAt: now,
    updatedAt: now,
    revisionNumber: 0,
    revisionHistory: [],
    undoRevision: null,
    draftBrief: parsedDraft,
    planBrief: parsedPlanBrief,
    proposal: parsedProposal,
    origin,
    edited: false,
    manualProposalFields: [],
    manualTaskIds: [],
    budget: {
      currency: parsedPlanBrief.currency,
      capMinor,
      reviewComplete: false,
      items: costItems,
    },
    guestSummary: {
      expected: parsedPlanBrief.guestCount,
      confirmed: null,
      adultCount: null,
      childCount: null,
      identitiesStored: false,
    },
    sessionAttendance: parsedPlanBrief.sessions.map((session) => ({
      sessionId: session.id,
      confirmedGuests: null,
    })),
    preferences,
    tasks,
    vendors,
  });
}

export function validateSavedPlan(input: unknown): SavedPlan {
  const plan = savedPlanSchema.parse(input);
  const expectedCap = parseBudgetMinor(
    plan.planBrief.budgetAmount,
    plan.planBrief.currency,
  );
  if (expectedCap !== plan.budget.capMinor) {
    throw new Error("The saved budget cap does not match the event brief.");
  }
  validateProposalForBrief(plan.proposal, plan.planBrief);
  buildPlanResult(plan.proposal, plan.budget.currency, plan.budget.capMinor);
  if (plan.undoRevision) {
    // A snapshot is imported data too: validate references, totals and cycles now,
    // before a user attempts to restore it. Clear undo to keep this check bounded.
    validateSavedPlan({
      ...plan,
      ...plan.undoRevision.snapshot,
      undoRevision: null,
    });
  }
  return plan;
}

export function createWorkspace(plan: SavedPlan): Workspace {
  return workspaceSchema.parse({
    format: "mehfiloom-workspace",
    schemaVersion: WORKSPACE_VERSION,
    activePlanId: plan.id,
    plans: [validateSavedPlan(plan)],
  });
}

export type PlanRevisionSnapshot = z.infer<typeof planContentSchema>;

function reidentifyContent(
  content: PlanRevisionSnapshot,
  newId: string,
): PlanRevisionSnapshot {
  const taskIds = new Map(
    content.tasks.map((task, index) => [
      task.id,
      scopedPlanId(newId, `:task:${index + 1}`),
    ]),
  );
  const vendorIds = new Map(
    content.vendors.map((vendor, index) => [
      vendor.id,
      scopedPlanId(newId, `:vendor:${index + 1}`),
    ]),
  );
  const sessionIds = new Map<string, string>();
  [...content.draftBrief.sessions, ...content.planBrief.sessions].forEach(
    (session) => {
      if (!sessionIds.has(session.id))
        sessionIds.set(
          session.id,
          scopedPlanId(newId, `:session:${sessionIds.size + 1}`),
        );
    },
  );
  const reidentifyBrief = (brief: EventBrief): EventBrief => ({
    ...brief,
    sessions: brief.sessions.map((session) => ({
      ...session,
      id: sessionIds.get(session.id) ?? session.id,
    })),
  });
  return planContentSchema.parse({
    ...content,
    draftBrief: reidentifyBrief(content.draftBrief),
    planBrief: reidentifyBrief(content.planBrief),
    proposal: {
      ...content.proposal,
      timeline: content.proposal.timeline.map((task) => ({
        ...task,
        ...(task.sessionId
          ? { sessionId: sessionIds.get(task.sessionId) ?? task.sessionId }
          : {}),
      })),
    },
    sessionAttendance: content.sessionAttendance.map((attendance) => ({
      ...attendance,
      sessionId: sessionIds.get(attendance.sessionId) ?? attendance.sessionId,
    })),
    manualTaskIds: content.manualTaskIds
      .map((taskId) => taskIds.get(taskId))
      .filter((taskId): taskId is string => Boolean(taskId)),
    tasks: content.tasks.map((task, index) => ({
      ...task,
      id: taskIds.get(task.id) ?? scopedPlanId(newId, `:task:${index + 1}`),
      sessionId: task.sessionId
        ? (sessionIds.get(task.sessionId) ?? task.sessionId)
        : null,
      dependencyIds: task.dependencyIds.map(
        (dependencyId) => taskIds.get(dependencyId) ?? dependencyId,
      ),
    })),
    vendors: content.vendors.map((vendor, index) => ({
      ...vendor,
      id:
        vendorIds.get(vendor.id) ?? scopedPlanId(newId, `:vendor:${index + 1}`),
    })),
    budget: {
      ...content.budget,
      items: content.budget.items.map((item, index) => ({
        ...item,
        id: scopedPlanId(newId, `:cost:${index + 1}`),
        payments: item.payments.map((payment, paymentIndex) => ({
          ...payment,
          id: `${newId.slice(0, 64)}:cost:${index + 1}:payment:${paymentIndex + 1}`,
        })),
        sessionId: item.sessionId
          ? (sessionIds.get(item.sessionId) ?? item.sessionId)
          : null,
        vendorId: item.vendorId ? (vendorIds.get(item.vendorId) ?? null) : null,
      })),
    },
    preferences: content.preferences.map((preference, index) => ({
      ...preference,
      id: scopedPlanId(newId, `:preference:${index + 1}`),
    })),
  });
}

export function reidentifyPlan(
  plan: SavedPlan,
  newId = makeId(),
  now = new Date().toISOString(),
): SavedPlan {
  const validated = validateSavedPlan(plan);
  return validateSavedPlan({
    ...validated,
    ...reidentifyContent(capturePlanContent(validated), newId),
    id: newId,
    createdAt: now,
    updatedAt: now,
    revisionHistory: validated.revisionHistory.map((entry) => {
      const suffix = `:revision:${entry.revisionNumber}`;
      return { ...entry, id: scopedPlanId(newId, suffix) };
    }),
    undoRevision: validated.undoRevision
      ? {
          ...validated.undoRevision,
          acceptedAt: now,
          snapshot: reidentifyContent(validated.undoRevision.snapshot, newId),
        }
      : null,
  });
}

export function parseWorkspaceJson(raw: string): Workspace {
  if (new TextEncoder().encode(raw).byteLength > MAX_WORKSPACE_BYTES) {
    throw new Error("Saved workspace is too large to load safely.");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new Error("Saved workspace is not valid JSON.");
  }
  const workspace = workspaceSchema.parse(decoded);
  return workspaceSchema.parse({
    ...workspace,
    plans: workspace.plans.map(validateSavedPlan),
  });
}

export function serializeWorkspace(workspace: Workspace): string {
  const validated = workspaceSchema.parse({
    ...workspace,
    plans: workspace.plans.map(validateSavedPlan),
  });
  const serialized = JSON.stringify(validated, null, 2);
  if (new TextEncoder().encode(serialized).byteLength > MAX_WORKSPACE_BYTES) {
    throw new Error(
      "Saved plans exceed the local storage limit. Export a plan and remove older plans.",
    );
  }
  return serialized;
}

export function parsePlanDocument(raw: string): SavedPlan {
  if (new TextEncoder().encode(raw).byteLength > MAX_PLAN_DOCUMENT_BYTES) {
    throw new Error("This plan file is too large to import.");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new Error("This plan file is not valid JSON.");
  }
  const document = planDocumentSchema.parse(decoded);
  return validateSavedPlan(document.plan);
}

export function serializePlanDocument(plan: SavedPlan): string {
  const serialized = JSON.stringify(
    {
      format: "mehfiloom-plan",
      schemaVersion: WORKSPACE_VERSION,
      plan: validateSavedPlan(plan),
    },
    null,
    2,
  );
  if (
    new TextEncoder().encode(serialized).byteLength > MAX_PLAN_DOCUMENT_BYTES
  ) {
    throw new Error("This plan is too large to export as one file.");
  }
  return serialized;
}

export type BudgetHealth = {
  knownCostsMinor: number;
  knownCostsMaxMinor: number;
  reserveMinor: number;
  forecastWithReserveMinor: number;
  forecastWithReserveMaxMinor: number;
  paidMinor: number;
  outstandingCommittedMinor: number;
  unresolvedCount: number;
  unresolvedMandatoryCount: number;
  unresolvedMandatoryChargeCount: number;
  state: "within_cap" | "over_cap" | "range_crosses_cap" | "unknown";
};

export function calculateBudgetHealth(plan: SavedPlan): BudgetHealth {
  const validated = validateSavedPlan(plan);
  const allocation = buildPlanResult(
    validated.proposal,
    validated.budget.currency,
    validated.budget.capMinor,
  );
  const reserveMinor =
    allocation.lines.find((line) => line.category === "contingency")
      ?.amountMinor ?? 0;
  const forecasts = validated.budget.items.map((item) => ({
    item,
    forecast: forecastCostItem(
      item,
      expectedGuestsForCostItem(validated, item),
    ),
  }));
  const known = forecasts.filter(
    ({ forecast }) => forecast.lowerMinor !== null,
  );
  const knownCostsMinor = safeMinor(
    known.reduce(
      (sum, { forecast }) => sum + BigInt(forecast.lowerMinor ?? 0),
      0n,
    ),
  );
  const knownCostsMaxMinor = safeMinor(
    known.reduce(
      (sum, { forecast }) => sum + BigInt(forecast.upperMinor ?? 0),
      0n,
    ),
  );
  const committed = forecasts.filter(
    ({ item }) => item.evidence === "committed",
  );
  const committedMinor = safeMinor(
    committed.reduce(
      (sum, { forecast }) => sum + BigInt(forecast.lowerMinor ?? 0),
      0n,
    ),
  );
  const paidMinor = safeMinor(
    validated.budget.items.reduce(
      (sum, item) => sum + BigInt(item.paidMinor),
      0n,
    ),
  );
  const committedPaidMinor = safeMinor(
    committed.reduce((sum, { item }) => sum + BigInt(item.paidMinor), 0n),
  );
  const unresolved = validated.budget.items.filter(
    (item) => item.amountMinor === null,
  );
  const unresolvedMandatoryChargeCount = validated.budget.items.filter(
    (item) =>
      item.mandatory &&
      item.amountMinor !== null &&
      (!item.chargesReviewed ||
        (item.feesIncluded !== true &&
          !item.adjustments.some((adjustment) => adjustment.kind === "fee")) ||
        (item.taxesIncluded !== true &&
          !item.adjustments.some((adjustment) => adjustment.kind === "tax"))),
  ).length;
  const forecastWithReserveMinor = safeMinor(
    BigInt(knownCostsMinor) + BigInt(reserveMinor),
  );
  const forecastWithReserveMaxMinor = safeMinor(
    BigInt(knownCostsMaxMinor) + BigInt(reserveMinor),
  );
  const state =
    forecastWithReserveMinor > validated.budget.capMinor
      ? "over_cap"
      : forecastWithReserveMaxMinor > validated.budget.capMinor
        ? "range_crosses_cap"
        : !validated.budget.reviewComplete ||
            unresolved.some((item) => item.mandatory) ||
            unresolvedMandatoryChargeCount > 0
          ? "unknown"
          : "within_cap";

  return {
    knownCostsMinor,
    knownCostsMaxMinor,
    reserveMinor,
    forecastWithReserveMinor,
    forecastWithReserveMaxMinor,
    paidMinor,
    outstandingCommittedMinor: Math.max(0, committedMinor - committedPaidMinor),
    unresolvedCount: unresolved.length,
    unresolvedMandatoryCount: unresolved.filter((item) => item.mandatory)
      .length,
    unresolvedMandatoryChargeCount,
    state,
  };
}

export function makeId(): string {
  return globalThis.crypto.randomUUID();
}

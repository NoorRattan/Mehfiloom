import { z } from "zod";
import {
  BUDGET_CATEGORIES,
  buildPlanResult,
  eventBriefSchema,
  parseBudgetMinor,
  proposalSchema,
  type EventBrief,
  type PlannerProposal,
} from "./planner.ts";

export const WORKSPACE_STORAGE_KEY = "mehfiloom.workspace.v1";
export const WORKSPACE_VERSION = 1;
export const MAX_SAVED_PLANS = 12;
export const MAX_PLAN_DOCUMENT_BYTES = 500_000;
export const MAX_WORKSPACE_BYTES = 2_000_000;

const idSchema = z.string().min(3).max(100).regex(/^[A-Za-z0-9:_-]+$/);
const dateOnlySchema = z.string().refine((value) => {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "Enter a valid date.");

export const taskRecordSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(5).max(120),
  timing: z.string().trim().min(3).max(80),
  priority: z.enum(["high", "medium", "low"]),
  status: z.enum(["todo", "in_progress", "done", "blocked"]),
  ownerLabel: z.string().trim().max(80),
  dueDate: dateOnlySchema.nullable(),
  dependencyIds: z.array(idSchema).max(20),
}).strict();

export const vendorRecordSchema = z.object({
  id: idSchema,
  category: z.string().trim().min(3).max(60),
  questions: z.array(z.string().trim().min(5).max(150)).min(3).max(6),
  name: z.string().trim().max(80).nullable(),
  availability: z.enum(["unknown", "inquiry_pending", "confirmed", "expired"]),
  booking: z.enum(["not_booked", "host_recorded", "cancelled"]),
  checkedAt: z.string().datetime().nullable(),
  notes: z.string().max(500),
}).strict();

export const costItemSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(2).max(100),
  category: z.enum(BUDGET_CATEGORIES),
  vendorId: idSchema.nullable(),
  amountMinor: z.number().int().min(0).max(1_000_000_000_000).nullable(),
  amountMaxMinor: z.number().int().positive().max(1_000_000_000_000).nullable().default(null),
  pricingModel: z.enum(["fixed", "per_guest"]).default("fixed"),
  evidence: z.enum(["unpriced", "estimate", "quote", "committed"]),
  paidMinor: z.number().int().min(0).max(1_000_000_000_000),
  mandatory: z.boolean(),
  validUntil: dateOnlySchema.nullable(),
  minimumGuestCount: z.number().int().min(1).max(10000).nullable(),
  feesIncluded: z.boolean().nullable(),
  exclusions: z.array(z.string().trim().min(2).max(160)).max(12),
  sourceNote: z.string().max(300),
}).strict().superRefine((item, context) => {
  if (item.evidence === "unpriced" && item.amountMinor !== null) {
    context.addIssue({ code: "custom", path: ["amountMinor"], message: "Unpriced items must not include an amount." });
  }
  if (item.evidence === "unpriced" && item.amountMaxMinor !== null) {
    context.addIssue({ code: "custom", path: ["amountMaxMinor"], message: "Unpriced items must not include an amount range." });
  }
  if (item.evidence !== "unpriced" && (item.amountMinor === null || item.amountMinor <= 0)) {
    context.addIssue({ code: "custom", path: ["amountMinor"], message: "Priced items need a positive amount." });
  }
  if (item.amountMinor !== null && item.amountMaxMinor !== null && item.amountMaxMinor < item.amountMinor) {
    context.addIssue({ code: "custom", path: ["amountMaxMinor"], message: "The upper amount must be at least the lower amount." });
  }
  if (item.evidence === "committed" && item.amountMaxMinor !== null && item.amountMaxMinor !== item.amountMinor) {
    context.addIssue({ code: "custom", path: ["amountMaxMinor"], message: "A commitment must have one exact amount." });
  }
  if (item.paidMinor > 0 && item.evidence !== "committed") {
    context.addIssue({ code: "custom", path: ["paidMinor"], message: "Payments can only be recorded against a commitment." });
  }
});

const preferenceSchema = z.object({
  id: idSchema,
  statement: z.string().trim().min(2).max(700),
  priority: z.enum(["hard", "preference"]),
  source: z.literal("host"),
  confirmed: z.boolean(),
}).strict();

const guestSummarySchema = z.object({
  expected: z.number().int().min(1).max(10000),
  confirmed: z.number().int().min(0).max(10000).nullable(),
  adultCount: z.number().int().min(0).max(10000).nullable(),
  childCount: z.number().int().min(0).max(10000).nullable(),
  identitiesStored: z.literal(false),
}).strict();

export const savedPlanSchema = z.object({
  schemaVersion: z.literal(WORKSPACE_VERSION),
  id: idSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  draftBrief: eventBriefSchema,
  planBrief: eventBriefSchema,
  proposal: proposalSchema,
  origin: z.enum(["example", "ai"]),
  edited: z.boolean(),
  budget: z.object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    capMinor: z.number().int().positive().max(1_000_000_000_000),
    reviewComplete: z.boolean(),
    items: z.array(costItemSchema).max(100),
  }).strict(),
  guestSummary: guestSummarySchema,
  preferences: z.array(preferenceSchema).max(30),
  tasks: z.array(taskRecordSchema).min(1).max(40),
  vendors: z.array(vendorRecordSchema).max(30),
}).strict().superRefine((plan, context) => {
  const unique = (items: { id: string }[], path: string) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (seen.has(item.id)) context.addIssue({ code: "custom", path: [path, index, "id"], message: "IDs must be unique within a plan." });
      seen.add(item.id);
    });
  };

  unique(plan.tasks, "tasks");
  unique(plan.vendors, "vendors");
  unique(plan.budget.items, "budget.items");
  unique(plan.preferences, "preferences");

  const taskIds = new Set(plan.tasks.map((task) => task.id));
  plan.tasks.forEach((task, index) => {
    for (const dependencyId of task.dependencyIds) {
      if (!taskIds.has(dependencyId)) {
        context.addIssue({ code: "custom", path: ["tasks", index, "dependencyIds"], message: "Task dependencies must reference a task in this plan." });
      }
    }
  });

  const vendorIds = new Set(plan.vendors.map((vendor) => vendor.id));
  plan.budget.items.forEach((item, index) => {
    if (item.vendorId && !vendorIds.has(item.vendorId)) {
      context.addIssue({ code: "custom", path: ["budget", "items", index, "vendorId"], message: "Cost items must reference a vendor in this plan." });
    }
    if (item.evidence === "committed" && item.amountMinor !== null) {
      const units = item.pricingModel === "per_guest"
        ? Math.max(plan.guestSummary.expected, item.minimumGuestCount ?? plan.guestSummary.expected)
        : 1;
      if (BigInt(item.paidMinor) > BigInt(item.amountMinor) * BigInt(units)) {
        context.addIssue({ code: "custom", path: ["budget", "items", index, "paidMinor"], message: "Paid amount cannot exceed the commitment total." });
      }
    }
  });

  if (plan.budget.currency !== plan.planBrief.currency) {
    context.addIssue({ code: "custom", path: ["budget", "currency"], message: "Budget and event currencies must match." });
  }
  if (plan.guestSummary.expected !== plan.planBrief.guestCount) {
    context.addIssue({ code: "custom", path: ["guestSummary", "expected"], message: "Expected guests must match the event brief snapshot." });
  }
});

export type CostItem = z.infer<typeof costItemSchema>;
export type VendorRecord = z.infer<typeof vendorRecordSchema>;
export type TaskRecord = z.infer<typeof taskRecordSchema>;
export type SavedPlan = z.infer<typeof savedPlanSchema>;

export type CostItemForecast = {
  units: number;
  lowerMinor: number | null;
  upperMinor: number | null;
};

function safeMinor(value: bigint): number {
  return value > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(value);
}

export function forecastCostItem(item: CostItem, expectedGuests: number): CostItemForecast {
  const units = item.pricingModel === "per_guest"
    ? Math.max(expectedGuests, item.minimumGuestCount ?? expectedGuests)
    : 1;
  if (item.amountMinor === null) return { units, lowerMinor: null, upperMinor: null };
  const multiplier = BigInt(units);
  return {
    units,
    lowerMinor: safeMinor(BigInt(item.amountMinor) * multiplier),
    upperMinor: safeMinor(BigInt(item.amountMaxMinor ?? item.amountMinor) * multiplier),
  };
}

export const workspaceSchema = z.object({
  format: z.literal("mehfiloom-workspace"),
  schemaVersion: z.literal(WORKSPACE_VERSION),
  activePlanId: idSchema,
  plans: z.array(savedPlanSchema).min(1).max(MAX_SAVED_PLANS),
}).strict().superRefine((workspace, context) => {
  const ids = workspace.plans.map((plan) => plan.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["plans"], message: "Saved plan IDs must be unique." });
  }
  if (!ids.includes(workspace.activePlanId)) {
    context.addIssue({ code: "custom", path: ["activePlanId"], message: "The selected plan must exist in this workspace." });
  }
});

export type Workspace = z.infer<typeof workspaceSchema>;

export const planDocumentSchema = z.object({
  format: z.literal("mehfiloom-plan"),
  schemaVersion: z.literal(WORKSPACE_VERSION),
  plan: savedPlanSchema,
}).strict();

function categoryForVendor(category: string): (typeof BUDGET_CATEGORIES)[number] {
  const text = category.toLowerCase();
  if (text.includes("venue")) return "venue";
  if (text.includes("cater") || text.includes("food")) return "food";
  if (text.includes("photo")) return "photography";
  if (text.includes("access")) return "accessibility";
  if (text.includes("decor")) return "decor";
  if (text.includes("music") || text.includes("entertain")) return "entertainment";
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
  const capMinor = parseBudgetMinor(parsedPlanBrief.budgetAmount, parsedPlanBrief.currency);
  buildPlanResult(parsedProposal, parsedPlanBrief.currency, capMinor);

  const vendors: VendorRecord[] = parsedProposal.vendorChecklist.map((vendor, index) => ({
    id: `${id}:vendor:${index + 1}`,
    category: vendor.category,
    questions: vendor.questions,
    name: null,
    availability: "unknown",
    booking: "not_booked",
    checkedAt: null,
    notes: "",
  }));
  const tasks: TaskRecord[] = parsedProposal.timeline.map((task, index) => ({
    id: `${id}:task:${index + 1}`,
    title: task.task,
    timing: task.timing,
    priority: task.priority,
    status: "todo",
    ownerLabel: "Host",
    dueDate: null,
    dependencyIds: [],
  }));
  const costItems: CostItem[] = vendors.map((vendor, index) => ({
    id: `${id}:cost:${index + 1}`,
    label: `${vendor.category} cost to confirm`,
    category: categoryForVendor(vendor.category),
    vendorId: vendor.id,
    amountMinor: null,
    amountMaxMinor: null,
    pricingModel: "fixed",
    evidence: "unpriced",
    paidMinor: 0,
    mandatory: false,
    validUntil: null,
    minimumGuestCount: null,
    feesIncluded: null,
    exclusions: [],
    sourceNote: "No quote or local price has been supplied.",
  }));
  const preferences = [
    ...(parsedPlanBrief.mustHaves ? [{
      id: `${id}:preference:must-haves`,
      statement: parsedPlanBrief.mustHaves,
      priority: "hard" as const,
      source: "host" as const,
      confirmed: true,
    }] : []),
    ...(parsedPlanBrief.style ? [{
      id: `${id}:preference:style`,
      statement: parsedPlanBrief.style,
      priority: "preference" as const,
      source: "host" as const,
      confirmed: true,
    }] : []),
  ];

  return validateSavedPlan({
    schemaVersion: WORKSPACE_VERSION,
    id,
    createdAt: now,
    updatedAt: now,
    draftBrief: parsedDraft,
    planBrief: parsedPlanBrief,
    proposal: parsedProposal,
    origin,
    edited: false,
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
    preferences,
    tasks,
    vendors,
  });
}

export function validateSavedPlan(input: unknown): SavedPlan {
  const plan = savedPlanSchema.parse(input);
  const expectedCap = parseBudgetMinor(plan.planBrief.budgetAmount, plan.planBrief.currency);
  if (expectedCap !== plan.budget.capMinor) {
    throw new Error("The saved budget cap does not match the event brief.");
  }
  buildPlanResult(plan.proposal, plan.budget.currency, plan.budget.capMinor);
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

export function reidentifyPlan(plan: SavedPlan, newId = makeId(), now = new Date().toISOString()): SavedPlan {
  const validated = validateSavedPlan(plan);
  const taskIds = new Map(validated.tasks.map((task, index) => [task.id, `${newId}:task:${index + 1}`]));
  const vendorIds = new Map(validated.vendors.map((vendor, index) => [vendor.id, `${newId}:vendor:${index + 1}`]));

  return validateSavedPlan({
    ...validated,
    id: newId,
    createdAt: now,
    updatedAt: now,
    tasks: validated.tasks.map((task, index) => ({
      ...task,
      id: taskIds.get(task.id) ?? `${newId}:task:${index + 1}`,
      dependencyIds: task.dependencyIds.map((dependencyId) => taskIds.get(dependencyId) ?? dependencyId),
    })),
    vendors: validated.vendors.map((vendor, index) => ({
      ...vendor,
      id: vendorIds.get(vendor.id) ?? `${newId}:vendor:${index + 1}`,
    })),
    budget: {
      ...validated.budget,
      items: validated.budget.items.map((item, index) => ({
        ...item,
        id: `${newId}:cost:${index + 1}`,
        vendorId: item.vendorId ? vendorIds.get(item.vendorId) ?? null : null,
      })),
    },
    preferences: validated.preferences.map((preference, index) => ({
      ...preference,
      id: `${newId}:preference:${index + 1}`,
    })),
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
    throw new Error("Saved plans exceed the local storage limit. Export a plan and remove older plans.");
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
  const serialized = JSON.stringify({
    format: "mehfiloom-plan",
    schemaVersion: WORKSPACE_VERSION,
    plan: validateSavedPlan(plan),
  }, null, 2);
  if (new TextEncoder().encode(serialized).byteLength > MAX_PLAN_DOCUMENT_BYTES) {
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
  unknownMandatoryFeeCount: number;
  state: "within_cap" | "over_cap" | "range_crosses_cap" | "unknown";
};

export function calculateBudgetHealth(plan: SavedPlan): BudgetHealth {
  const validated = validateSavedPlan(plan);
  const allocation = buildPlanResult(
    validated.proposal,
    validated.budget.currency,
    validated.budget.capMinor,
  );
  const reserveMinor = allocation.lines.find((line) => line.category === "contingency")?.amountMinor ?? 0;
  const forecasts = validated.budget.items.map((item) => ({
    item,
    forecast: forecastCostItem(item, validated.guestSummary.expected),
  }));
  const known = forecasts.filter(({ forecast }) => forecast.lowerMinor !== null);
  const knownCostsMinor = safeMinor(known.reduce((sum, { forecast }) => sum + BigInt(forecast.lowerMinor ?? 0), 0n));
  const knownCostsMaxMinor = safeMinor(known.reduce((sum, { forecast }) => sum + BigInt(forecast.upperMinor ?? 0), 0n));
  const committed = forecasts.filter(({ item }) => item.evidence === "committed");
  const committedMinor = safeMinor(committed.reduce((sum, { forecast }) => sum + BigInt(forecast.lowerMinor ?? 0), 0n));
  const paidMinor = safeMinor(validated.budget.items.reduce((sum, item) => sum + BigInt(item.paidMinor), 0n));
  const committedPaidMinor = safeMinor(committed.reduce((sum, { item }) => sum + BigInt(item.paidMinor), 0n));
  const unresolved = validated.budget.items.filter((item) => item.amountMinor === null);
  const unknownMandatoryFeeCount = validated.budget.items.filter((item) => item.mandatory && item.amountMinor !== null && item.feesIncluded === null).length;
  const forecastWithReserveMinor = safeMinor(BigInt(knownCostsMinor) + BigInt(reserveMinor));
  const forecastWithReserveMaxMinor = safeMinor(BigInt(knownCostsMaxMinor) + BigInt(reserveMinor));
  const state = forecastWithReserveMinor > validated.budget.capMinor
    ? "over_cap"
    : forecastWithReserveMaxMinor > validated.budget.capMinor
      ? "range_crosses_cap"
      : (!validated.budget.reviewComplete || unresolved.some((item) => item.mandatory) || unknownMandatoryFeeCount > 0)
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
    unresolvedMandatoryCount: unresolved.filter((item) => item.mandatory).length,
    unknownMandatoryFeeCount,
    state,
  };
}

export function makeId(): string {
  return globalThis.crypto.randomUUID();
}

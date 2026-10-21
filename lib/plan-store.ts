import { z } from "zod";
import { addCalendarDays } from "./schedule.ts";
import {
  BUDGET_CATEGORIES,
  buildPlanResult,
  eventBriefSchema,
  parseBudgetMinor,
  proposalSchema,
  type EventBrief,
  type PlannerProposal,
} from "./planner.ts";

export const WORKSPACE_STORAGE_KEY = "mehfiloom.workspace.v5";
export const LEGACY_WORKSPACE_STORAGE_KEY = "mehfiloom.workspace.v4";
export const OLDER_WORKSPACE_STORAGE_KEY = "mehfiloom.workspace.v3";
export const SECOND_OLDER_WORKSPACE_STORAGE_KEY = "mehfiloom.workspace.v2";
export const OLDEST_WORKSPACE_STORAGE_KEY = "mehfiloom.workspace.v1";
export const WORKSPACE_VERSION = 5;
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
  relativeOffsetDays: z.number().int().min(-3650).max(3650).nullable().default(null),
  dependencyIds: z.array(idSchema).max(20),
  sessionId: idSchema.nullable().default(null),
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

export const costPaymentSchema = z.object({
  id: idSchema,
  amountMinor: z.number().int().positive().max(1_000_000_000_000),
  paidAt: dateOnlySchema.nullable(),
  note: z.string().trim().max(160),
}).strict();

export const costAdjustmentSchema = z.object({
  id: idSchema,
  kind: z.enum(["discount", "fee", "tax"]),
  label: z.string().trim().min(2).max(80),
  pricingModel: z.enum(["fixed", "per_guest"]).default("fixed"),
  amountMinor: z.number().int().min(0).max(1_000_000_000_000),
  amountMaxMinor: z.number().int().min(0).max(1_000_000_000_000).nullable().default(null),
  sourceNote: z.string().trim().min(3).max(300),
}).strict().superRefine((adjustment, context) => {
  if (adjustment.amountMaxMinor !== null && adjustment.amountMaxMinor < adjustment.amountMinor) {
    context.addIssue({ code: "custom", path: ["amountMaxMinor"], message: "The upper adjustment must be at least the lower amount." });
  }
});

export const costItemSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(2).max(100),
  category: z.enum(BUDGET_CATEGORIES),
  vendorId: idSchema.nullable(),
  sessionId: idSchema.nullable().default(null),
  amountMinor: z.number().int().min(0).max(1_000_000_000_000).nullable(),
  amountMaxMinor: z.number().int().positive().max(1_000_000_000_000).nullable().default(null),
  pricingModel: z.enum(["fixed", "per_guest"]).default("fixed"),
  evidence: z.enum(["unpriced", "estimate", "quote", "committed"]),
  paidMinor: z.number().int().min(0).max(1_000_000_000_000),
  payments: z.array(costPaymentSchema).max(100),
  mandatory: z.boolean(),
  validUntil: dateOnlySchema.nullable(),
  minimumGuestCount: z.number().int().min(1).max(10000).nullable(),
  feesIncluded: z.boolean().nullable(),
  taxesIncluded: z.boolean().nullable().default(null),
  chargesReviewed: z.boolean().default(false),
  adjustments: z.array(costAdjustmentSchema).max(20).default([]),
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
  const paymentIds = item.payments.map((payment) => payment.id);
  if (new Set(paymentIds).size !== paymentIds.length) {
    context.addIssue({ code: "custom", path: ["payments"], message: "Payment IDs must be unique within a cost." });
  }
  const paymentTotal = item.payments.reduce((sum, payment) => sum + BigInt(payment.amountMinor), 0n);
  if (paymentTotal !== BigInt(item.paidMinor)) {
    context.addIssue({ code: "custom", path: ["payments"], message: "Recorded payments must add up to the paid total." });
  }
  if (item.payments.length > 0 && item.evidence !== "committed") {
    context.addIssue({ code: "custom", path: ["payments"], message: "Payments can only be recorded against a commitment." });
  }
  const adjustmentIds = item.adjustments.map((adjustment) => adjustment.id);
  if (new Set(adjustmentIds).size !== adjustmentIds.length) {
    context.addIssue({ code: "custom", path: ["adjustments"], message: "Adjustment IDs must be unique within a cost." });
  }
  if (item.feesIncluded === true && item.adjustments.some((adjustment) => adjustment.kind === "fee")) {
    context.addIssue({ code: "custom", path: ["adjustments"], message: "A cost cannot mark fees included and also add a separate fee. Set the fee status to excluded or extra." });
  }
  if (item.taxesIncluded === true && item.adjustments.some((adjustment) => adjustment.kind === "tax")) {
    context.addIssue({ code: "custom", path: ["adjustments"], message: "A cost cannot mark taxes included and also add a separate tax. Set the tax status to excluded or extra." });
  }
  if (item.evidence === "committed" && item.adjustments.some((adjustment) => adjustment.amountMaxMinor !== null && adjustment.amountMaxMinor !== adjustment.amountMinor)) {
    context.addIssue({ code: "custom", path: ["adjustments"], message: "A committed cost must use exact fee, tax, and discount amounts." });
  }
  if (item.chargesReviewed && (item.sourceNote.trim().length < 3 || /^no quote or local price has been supplied\.?$/i.test(item.sourceNote.trim()))) {
    context.addIssue({ code: "custom", path: ["sourceNote"], message: "Record the actual quote or source used to confirm fees and taxes before completing this review." });
  }
  if (item.chargesReviewed && item.amountMinor === null) {
    context.addIssue({ code: "custom", path: ["chargesReviewed"], message: "Price the cost before completing its fee and tax review." });
  }
  if (item.chargesReviewed && (item.feesIncluded === null || item.taxesIncluded === null)) {
    context.addIssue({ code: "custom", path: ["chargesReviewed"], message: "Record whether fees and taxes are included or recorded separately before completing this review." });
  }
  if (item.chargesReviewed && item.feesIncluded === false && !item.adjustments.some((adjustment) => adjustment.kind === "fee")) {
    context.addIssue({ code: "custom", path: ["chargesReviewed"], message: "Record a sourced fee amount, including zero when no separate fee applies." });
  }
  if (item.chargesReviewed && item.taxesIncluded === false && !item.adjustments.some((adjustment) => adjustment.kind === "tax")) {
    context.addIssue({ code: "custom", path: ["chargesReviewed"], message: "Record a sourced tax amount, including zero when no separate tax applies." });
  }
});

export type CostAdjustment = z.infer<typeof costAdjustmentSchema>;

function adjustmentAmountMinor(adjustment: CostAdjustment, guestUnits: number, range: "lower" | "upper"): bigint {
  const amountMinor = range === "upper" ? adjustment.amountMaxMinor ?? adjustment.amountMinor : adjustment.amountMinor;
  const multiplier = adjustment.pricingModel === "per_guest" ? guestUnits : 1;
  return BigInt(amountMinor) * BigInt(multiplier);
}

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

const sessionAttendanceSchema = z.object({
  sessionId: idSchema,
  confirmedGuests: z.number().int().min(0).max(10000).nullable(),
}).strict();

const manualProposalFieldSchema = z.enum(["conceptTitle", "overview", "theme"]);
const revisionHistoryEntrySchema = z.object({
  id: idSchema,
  baseRevisionNumber: z.number().int().min(0).max(100),
  revisionNumber: z.number().int().min(1).max(100),
  request: z.string().trim().min(8).max(500),
  acceptedAt: z.string().datetime(),
  changedSections: z.array(z.string().trim().min(2).max(60)).max(12),
  preservedSections: z.array(z.string().trim().min(2).max(80)).max(12),
}).strict();

const budgetSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  capMinor: z.number().int().positive().max(1_000_000_000_000),
  reviewComplete: z.boolean(),
  items: z.array(costItemSchema).max(100),
}).strict();

const planContentSchema = z.object({
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
}).strict();

const undoRevisionSchema = z.object({
  acceptedAt: z.string().datetime(),
  revisionNumber: z.number().int().min(1).max(100),
  snapshot: planContentSchema,
}).strict();

const savedPlanBaseSchema = z.object({
  schemaVersion: z.literal(WORKSPACE_VERSION),
  id: idSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  revisionNumber: z.number().int().min(0).max(100).default(0),
  revisionHistory: z.array(revisionHistoryEntrySchema).max(20).default([]),
  undoRevision: undoRevisionSchema.nullable().default(null),
  ...planContentSchema.shape,
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

  const sessionIds = new Set(plan.planBrief.sessions.map((session) => session.id));
  const attendanceIds = plan.sessionAttendance.map((attendance) => attendance.sessionId);
  if (new Set(attendanceIds).size !== attendanceIds.length) {
    context.addIssue({ code: "custom", path: ["sessionAttendance"], message: "Session attendance entries must be unique." });
  }
  if (attendanceIds.length !== sessionIds.size || attendanceIds.some((sessionId) => !sessionIds.has(sessionId))) {
    context.addIssue({ code: "custom", path: ["sessionAttendance"], message: "Each planned session must have one attendance record." });
  }

  const taskIds = new Set(plan.tasks.map((task) => task.id));
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
      context.addIssue({ code: "custom", path: ["tasks", index, "sessionId"], message: "Tasks must reference a session in this plan." });
    }
    if (new Set(task.dependencyIds).size !== task.dependencyIds.length) {
      context.addIssue({ code: "custom", path: ["tasks", index, "dependencyIds"], message: "A task cannot list the same prerequisite more than once." });
    }
    for (const dependencyId of task.dependencyIds) {
      if (!taskIds.has(dependencyId)) {
        context.addIssue({ code: "custom", path: ["tasks", index, "dependencyIds"], message: "Task dependencies must reference a task in this plan." });
      }
    }
  });

  for (const task of plan.tasks) visitDependencies(task.id);
  if (dependencyCycleFound) {
    context.addIssue({ code: "custom", path: ["tasks"], message: "Task dependencies cannot contain a cycle." });
  }

  const vendorIds = new Set(plan.vendors.map((vendor) => vendor.id));
  let forecastMaximumWithReserveMinor = BigInt(plan.budget.capMinor);
  plan.budget.items.forEach((item, index) => {
    if (item.sessionId && !sessionIds.has(item.sessionId)) {
      context.addIssue({ code: "custom", path: ["budget", "items", index, "sessionId"], message: "Costs must reference a session in this plan." });
    }
    if (item.vendorId && !vendorIds.has(item.vendorId)) {
      context.addIssue({ code: "custom", path: ["budget", "items", index, "vendorId"], message: "Cost items must reference a vendor in this plan." });
    }
    const sessionGuests = item.sessionId
      ? plan.planBrief.sessions.find((session) => session.id === item.sessionId)?.guestCount ?? plan.guestSummary.expected
      : plan.guestSummary.expected;
    const guestUnits = Math.max(sessionGuests, item.minimumGuestCount ?? sessionGuests);
    const units = item.pricingModel === "per_guest" ? guestUnits : 1;
    const baseLowerMinor = item.amountMinor === null ? 0n : BigInt(item.amountMinor) * BigInt(units);
    const baseUpperMinor = item.amountMinor === null ? 0n : BigInt(item.amountMaxMinor ?? item.amountMinor) * BigInt(units);
    const discountsUpperMinor = item.adjustments
      .filter((adjustment) => adjustment.kind === "discount")
      .reduce((sum, adjustment) => sum + adjustmentAmountMinor(adjustment, guestUnits, "upper"), 0n);
    const discountsLowerMinor = item.adjustments
      .filter((adjustment) => adjustment.kind === "discount")
      .reduce((sum, adjustment) => sum + adjustmentAmountMinor(adjustment, guestUnits, "lower"), 0n);
    if (item.amountMinor !== null && discountsUpperMinor > baseLowerMinor) {
      context.addIssue({ code: "custom", path: ["budget", "items", index, "adjustments"], message: "Discounts cannot exceed the lowest base cost." });
    }
    const feesLowerMinor = item.adjustments
      .filter((adjustment) => adjustment.kind === "fee")
      .reduce((sum, adjustment) => sum + adjustmentAmountMinor(adjustment, guestUnits, "lower"), 0n);
    const feesUpperMinor = item.adjustments
      .filter((adjustment) => adjustment.kind === "fee")
      .reduce((sum, adjustment) => sum + adjustmentAmountMinor(adjustment, guestUnits, "upper"), 0n);
    const taxesLowerMinor = item.adjustments
      .filter((adjustment) => adjustment.kind === "tax")
      .reduce((sum, adjustment) => sum + adjustmentAmountMinor(adjustment, guestUnits, "lower"), 0n);
    const taxesUpperMinor = item.adjustments
      .filter((adjustment) => adjustment.kind === "tax")
      .reduce((sum, adjustment) => sum + adjustmentAmountMinor(adjustment, guestUnits, "upper"), 0n);
    const commitmentTotalLowerMinor = baseLowerMinor - discountsUpperMinor + feesLowerMinor + taxesLowerMinor;
    const forecastUpperMinor = baseUpperMinor - discountsLowerMinor + feesUpperMinor + taxesUpperMinor;
    if (item.evidence === "committed" && baseUpperMinor - discountsLowerMinor + feesLowerMinor + taxesLowerMinor !== commitmentTotalLowerMinor) {
      context.addIssue({ code: "custom", path: ["budget", "items", index, "adjustments"], message: "Committed costs require exact adjustment amounts." });
    }
    if (forecastUpperMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
      context.addIssue({ code: "custom", path: ["budget", "items", index, "adjustments"], message: "This cost exceeds the supported exact forecast range." });
    }
    if (forecastUpperMinor >= 0n) forecastMaximumWithReserveMinor += forecastUpperMinor;
    if (BigInt(item.paidMinor) > commitmentTotalLowerMinor) {
      context.addIssue({ code: "custom", path: ["budget", "items", index, "paidMinor"], message: "Paid amount cannot exceed the commitment total after discounts, fees, and taxes." });
    }
  });
  if (forecastMaximumWithReserveMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
    context.addIssue({ code: "custom", path: ["budget", "items"], message: "Combined cost forecasts exceed the supported exact range." });
  }

  if (plan.budget.currency !== plan.planBrief.currency) {
    context.addIssue({ code: "custom", path: ["budget", "currency"], message: "Budget and event currencies must match." });
  }
  if (plan.guestSummary.expected !== plan.planBrief.guestCount) {
    context.addIssue({ code: "custom", path: ["guestSummary", "expected"], message: "Expected guests must match the event brief snapshot." });
  }
});

function migrateBudgetPaymentHistory(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const budget = value as Record<string, unknown>;
  if (!Array.isArray(budget.items)) return value;
  return {
    ...budget,
    items: budget.items.map((rawItem) => {
      if (typeof rawItem !== "object" || rawItem === null || Array.isArray(rawItem)) return rawItem;
      const item = rawItem as Record<string, unknown>;
      if ("payments" in item) return item;
      const paidMinor = typeof item.paidMinor === "number" && Number.isSafeInteger(item.paidMinor) && item.paidMinor > 0 ? item.paidMinor : 0;
      return {
        ...item,
        payments: paidMinor > 0 ? [{ id: "legacy-payment-1", amountMinor: paidMinor, paidAt: null, note: "Existing total; payment date not recorded." }] : [],
      };
    }),
  };
}

function migrateSavedPlanMetadata(input: unknown): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
  const plan = input as Record<string, unknown>;
  const migrated = { ...plan };
  if (typeof migrated.schemaVersion === "number" && migrated.schemaVersion < WORKSPACE_VERSION) migrated.schemaVersion = WORKSPACE_VERSION;
  if (!("revisionNumber" in migrated)) migrated.revisionNumber = 0;
  if (!("revisionHistory" in migrated)) migrated.revisionHistory = [];
  if (!("undoRevision" in migrated)) migrated.undoRevision = null;
  if (!("manualProposalFields" in migrated)) {
    migrated.manualProposalFields = migrated.edited === true ? ["conceptTitle", "overview", "theme"] : [];
  }
  if (!("manualTaskIds" in migrated)) {
    migrated.manualTaskIds = migrated.edited === true && Array.isArray(migrated.tasks)
      ? migrated.tasks.flatMap((task) => typeof task === "object" && task !== null && "id" in task && typeof task.id === "string" ? [task.id] : [])
      : [];
  }
  if (!("sessionAttendance" in migrated)) {
    const planBrief = migrated.planBrief as { sessions?: Array<{ id?: unknown }> } | undefined;
    migrated.sessionAttendance = Array.isArray(planBrief?.sessions)
      ? planBrief.sessions.flatMap((session) => typeof session.id === "string" ? [{ sessionId: session.id, confirmedGuests: null }] : [])
      : [];
  }
  migrated.budget = migrateBudgetPaymentHistory(migrated.budget);
  const undoRevision = migrated.undoRevision;
  if (typeof undoRevision === "object" && undoRevision !== null && !Array.isArray(undoRevision)) {
    const undoRecord = undoRevision as Record<string, unknown>;
    const snapshot = undoRecord.snapshot;
    if (typeof snapshot === "object" && snapshot !== null && !Array.isArray(snapshot)) {
      const snapshotRecord = snapshot as Record<string, unknown>;
      migrated.undoRevision = {
        ...undoRecord,
        snapshot: { ...snapshotRecord, budget: migrateBudgetPaymentHistory(snapshotRecord.budget) },
      };
    }
  }
  return migrated;
}

export const savedPlanSchema = z.preprocess(migrateSavedPlanMetadata, savedPlanBaseSchema);

export type CostItem = z.infer<typeof costItemSchema>;
export type CostPayment = z.infer<typeof costPaymentSchema>;
export type VendorRecord = z.infer<typeof vendorRecordSchema>;
export type TaskRecord = z.infer<typeof taskRecordSchema>;
export type SavedPlan = z.infer<typeof savedPlanSchema>;

export type TaskDateResolution = {
  anchorDate: string | null;
  relativeDate: string | null;
  fixedDate: string | null;
  dueDate: string | null;
};

export function resolveTaskDate(
  task: Pick<TaskRecord, "dueDate" | "relativeOffsetDays" | "sessionId">,
  eventDate: string,
  sessions: readonly Pick<EventBrief["sessions"][number], "id" | "date">[] = [],
): TaskDateResolution {
  const session = task.sessionId ? sessions.find((item) => item.id === task.sessionId) : null;
  const anchorDate = task.sessionId ? session?.date || null : eventDate || null;
  const relativeDate = task.relativeOffsetDays === null || !anchorDate
    ? null
    : addCalendarDays(anchorDate, task.relativeOffsetDays);
  return {
    anchorDate,
    relativeDate,
    fixedDate: task.dueDate,
    dueDate: task.dueDate ?? relativeDate,
  };
}

export function canAddTaskDependency(
  tasks: readonly Pick<TaskRecord, "id" | "dependencyIds">[],
  taskId: string,
  dependencyId: string,
): boolean {
  if (taskId === dependencyId) return false;
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const currentTask = taskById.get(taskId);
  if (!currentTask || !taskById.has(dependencyId) || currentTask.dependencyIds.includes(dependencyId)) return false;

  const pending = [dependencyId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const currentId = pending.pop();
    if (!currentId || visited.has(currentId)) continue;
    if (currentId === taskId) return false;
    visited.add(currentId);
    pending.push(...(taskById.get(currentId)?.dependencyIds ?? []));
  }
  return true;
}

export function canMarkTaskDone(
  task: Pick<TaskRecord, "dependencyIds">,
  tasks: readonly Pick<TaskRecord, "id" | "status">[],
): boolean {
  const taskById = new Map(tasks.map((item) => [item.id, item]));
  return task.dependencyIds.every((dependencyId) => taskById.get(dependencyId)?.status === "done");
}

export function canReopenTask(
  task: Pick<TaskRecord, "id" | "status">,
  tasks: readonly Pick<TaskRecord, "status" | "dependencyIds">[],
): boolean {
  return task.status !== "done" || !tasks.some(
    (candidate) => candidate.status === "done" && candidate.dependencyIds.includes(task.id),
  );
}

export function taskScheduleConflicts(
  tasks: readonly TaskRecord[],
  eventDate = "",
  today = "",
  sessions: readonly Pick<EventBrief["sessions"][number], "id" | "date">[] = [],
): Map<string, string[]> {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const conflicts = new Map<string, string[]>();

  for (const task of tasks) {
    const messages: string[] = [];
    const dates = resolveTaskDate(task, eventDate, sessions);
    const dueDate = dates.dueDate;
    if (task.relativeOffsetDays !== null && !dates.relativeDate) {
      messages.push(task.sessionId
        ? "Set this function's date to resolve its relative task date."
        : "Set the event date to resolve this relative task date.");
    }
    if (dates.relativeDate && task.dueDate && dates.relativeDate !== task.dueDate) {
      messages.push(`The relative target is ${dates.relativeDate}, but the fixed due date remains ${task.dueDate}; review the commitment before moving it.`);
    }
    const anchorLabel = task.sessionId ? "function date" : "event date";
    if (dates.anchorDate && dates.fixedDate && dates.fixedDate > dates.anchorDate) {
      messages.push(`This task is due ${dates.fixedDate}, after the ${anchorLabel} ${dates.anchorDate}.`);
    } else if (dates.anchorDate && !dates.fixedDate && dates.relativeDate && dates.relativeDate > dates.anchorDate) {
      messages.push(`This relative task target is ${dates.relativeDate}, after the ${anchorLabel} ${dates.anchorDate}.`);
    }
    if (dueDate && today && dueDate < today && task.status !== "done") {
      messages.push(`This task was due ${dueDate} and is still open.`);
    }
    if (dueDate) {
      const laterPrerequisites = task.dependencyIds
        .map((dependencyId) => taskById.get(dependencyId))
        .map((dependency) => dependency ? { task: dependency, dueDate: resolveTaskDate(dependency, eventDate, sessions).dueDate } : null)
        .filter((dependency): dependency is { task: TaskRecord; dueDate: string } => dependency !== null && dependency.dueDate !== null && dependency.dueDate > dueDate);
      messages.push(...laterPrerequisites.map(({ task: dependency, dueDate: dependencyDate }) => `${dependency.title} is due ${dependencyDate}, after this task.`));
    }
    if (messages.length > 0) conflicts.set(task.id, messages);
  }

  return conflicts;
}

export type CostItemForecast = {
  units: number;
  baseLowerMinor: number | null;
  baseUpperMinor: number | null;
  discountLowerMinor: number;
  discountUpperMinor: number;
  feeLowerMinor: number;
  feeUpperMinor: number;
  taxLowerMinor: number;
  taxUpperMinor: number;
  lowerMinor: number | null;
  upperMinor: number | null;
};

function safeMinor(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("This amount exceeds the supported exact forecast range.");
  }
  return Number(value);
}

export function forecastCostItem(item: CostItem, expectedGuests: number): CostItemForecast {
  const guestUnits = Math.max(expectedGuests, item.minimumGuestCount ?? expectedGuests);
  const units = item.pricingModel === "per_guest" ? guestUnits : 1;
  const multiplier = BigInt(units);
  const adjustmentTotal = (kind: CostAdjustment["kind"], range: "lower" | "upper") => item.adjustments
    .filter((adjustment) => adjustment.kind === kind)
    .reduce((sum, adjustment) => sum + adjustmentAmountMinor(adjustment, guestUnits, range), 0n);
  const discountLowerMinor = adjustmentTotal("discount", "lower");
  const discountUpperMinor = adjustmentTotal("discount", "upper");
  const feeLowerMinor = adjustmentTotal("fee", "lower");
  const feeUpperMinor = adjustmentTotal("fee", "upper");
  const taxLowerMinor = adjustmentTotal("tax", "lower");
  const taxUpperMinor = adjustmentTotal("tax", "upper");
  if (item.amountMinor === null) {
    return {
      units,
      baseLowerMinor: null,
      baseUpperMinor: null,
      discountLowerMinor: safeMinor(discountLowerMinor),
      discountUpperMinor: safeMinor(discountUpperMinor),
      feeLowerMinor: safeMinor(feeLowerMinor),
      feeUpperMinor: safeMinor(feeUpperMinor),
      taxLowerMinor: safeMinor(taxLowerMinor),
      taxUpperMinor: safeMinor(taxUpperMinor),
      lowerMinor: null,
      upperMinor: null,
    };
  }
  const baseLowerMinor = BigInt(item.amountMinor) * multiplier;
  const baseUpperMinor = BigInt(item.amountMaxMinor ?? item.amountMinor) * multiplier;
  if (discountUpperMinor > baseLowerMinor) throw new Error("Discounts cannot exceed the lowest base cost.");
  const lowerMinor = baseLowerMinor - discountUpperMinor + feeLowerMinor + taxLowerMinor;
  const upperMinor = baseUpperMinor - discountLowerMinor + feeUpperMinor + taxUpperMinor;
  if (lowerMinor < 0n || upperMinor < lowerMinor) throw new Error("The adjusted cost range is invalid.");
  return {
    units,
    baseLowerMinor: safeMinor(baseLowerMinor),
    baseUpperMinor: safeMinor(baseUpperMinor),
    discountLowerMinor: safeMinor(discountLowerMinor),
    discountUpperMinor: safeMinor(discountUpperMinor),
    feeLowerMinor: safeMinor(feeLowerMinor),
    feeUpperMinor: safeMinor(feeUpperMinor),
    taxLowerMinor: safeMinor(taxLowerMinor),
    taxUpperMinor: safeMinor(taxUpperMinor),
    lowerMinor: safeMinor(lowerMinor),
    upperMinor: safeMinor(upperMinor),
  };
}

export function addCostPayment(item: CostItem, payment: CostPayment, commitmentTotalMinor: number | null): CostItem {
  const validated = costItemSchema.parse(item);
  const parsedPayment = costPaymentSchema.parse(payment);
  if (validated.evidence !== "committed") throw new Error("Payments can only be recorded against a commitment.");
  if (validated.payments.length >= 100) throw new Error("This cost already has the maximum of 100 payment records.");
  if (validated.payments.some((existing) => existing.id === parsedPayment.id)) throw new Error("Payment IDs must be unique within a cost.");
  const paidMinor = BigInt(validated.paidMinor) + BigInt(parsedPayment.amountMinor);
  if (paidMinor > 1_000_000_000_000n) throw new Error("Recorded payments exceed the supported amount.");
  if (commitmentTotalMinor !== null && paidMinor > BigInt(commitmentTotalMinor)) {
    throw new Error("Payment cannot exceed the remaining commitment balance.");
  }
  return costItemSchema.parse({
    ...validated,
    paidMinor: Number(paidMinor),
    payments: [...validated.payments, parsedPayment],
  });
}

export function removeCostPayment(item: CostItem, paymentId: string): CostItem {
  const validated = costItemSchema.parse(item);
  const payments = validated.payments.filter((payment) => payment.id !== paymentId);
  if (payments.length === validated.payments.length) throw new Error("Payment record was not found.");
  const paidMinor = payments.reduce((sum, payment) => sum + payment.amountMinor, 0);
  return costItemSchema.parse({ ...validated, payments, paidMinor });
}

export function expectedGuestsForCostItem(
  plan: Pick<SavedPlan, "planBrief" | "guestSummary">,
  item: Pick<CostItem, "sessionId">,
): number {
  if (!item.sessionId) return plan.guestSummary.expected;
  return plan.planBrief.sessions.find((session) => session.id === item.sessionId)?.guestCount
    ?? plan.guestSummary.expected;
}

const workspaceBaseSchema = z.object({
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

export const workspaceSchema = z.preprocess((input) => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
  const workspace = input as Record<string, unknown>;
  return typeof workspace.schemaVersion === "number" && workspace.schemaVersion < WORKSPACE_VERSION
    ? { ...workspace, schemaVersion: WORKSPACE_VERSION }
    : input;
}, workspaceBaseSchema);

export type Workspace = z.infer<typeof workspaceSchema>;

const planDocumentBaseSchema = z.object({
  format: z.literal("mehfiloom-plan"),
  schemaVersion: z.literal(WORKSPACE_VERSION),
  plan: savedPlanSchema,
}).strict();

export const planDocumentSchema = z.preprocess((input) => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
  const document = input as Record<string, unknown>;
  return typeof document.schemaVersion === "number" && document.schemaVersion < WORKSPACE_VERSION
    ? { ...document, schemaVersion: WORKSPACE_VERSION }
    : input;
}, planDocumentBaseSchema);

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
    relativeOffsetDays: null,
    dependencyIds: [],
    sessionId: task.sessionId ?? null,
  }));
  const costItems: CostItem[] = vendors.map((vendor, index) => ({
    id: `${id}:cost:${index + 1}`,
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
    sessionAttendance: parsedPlanBrief.sessions.map((session) => ({ sessionId: session.id, confirmedGuests: null })),
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

export type PlanRevisionSnapshot = z.infer<typeof planContentSchema>;
type PlanContent = PlanRevisionSnapshot;

function planContentOf(plan: SavedPlan): PlanContent {
  return {
    draftBrief: plan.draftBrief,
    planBrief: plan.planBrief,
    proposal: plan.proposal,
    origin: plan.origin,
    edited: plan.edited,
    manualProposalFields: plan.manualProposalFields,
    manualTaskIds: plan.manualTaskIds,
    budget: plan.budget,
    guestSummary: plan.guestSummary,
    sessionAttendance: plan.sessionAttendance,
    preferences: plan.preferences,
    tasks: plan.tasks,
    vendors: plan.vendors,
  };
}

function reidentifyContent(content: PlanContent, newId: string): PlanContent {
  const taskIds = new Map(content.tasks.map((task, index) => [task.id, `${newId}:task:${index + 1}`]));
  const vendorIds = new Map(content.vendors.map((vendor, index) => [vendor.id, `${newId}:vendor:${index + 1}`]));
  const sessionIds = new Map<string, string>();
  [...content.draftBrief.sessions, ...content.planBrief.sessions].forEach((session) => {
    if (!sessionIds.has(session.id)) sessionIds.set(session.id, `${newId}:session:${sessionIds.size + 1}`);
  });
  const reidentifyBrief = (brief: EventBrief): EventBrief => ({
    ...brief,
    sessions: brief.sessions.map((session) => ({ ...session, id: sessionIds.get(session.id) ?? session.id })),
  });
  return planContentSchema.parse({
    ...content,
    draftBrief: reidentifyBrief(content.draftBrief),
    planBrief: reidentifyBrief(content.planBrief),
    sessionAttendance: content.sessionAttendance.map((attendance) => ({
      ...attendance,
      sessionId: sessionIds.get(attendance.sessionId) ?? attendance.sessionId,
    })),
    manualTaskIds: content.manualTaskIds.map((taskId) => taskIds.get(taskId)).filter((taskId): taskId is string => Boolean(taskId)),
    tasks: content.tasks.map((task, index) => ({
      ...task,
      id: taskIds.get(task.id) ?? `${newId}:task:${index + 1}`,
      sessionId: task.sessionId ? sessionIds.get(task.sessionId) ?? task.sessionId : null,
      dependencyIds: task.dependencyIds.map((dependencyId) => taskIds.get(dependencyId) ?? dependencyId),
    })),
    vendors: content.vendors.map((vendor, index) => ({
      ...vendor,
      id: vendorIds.get(vendor.id) ?? `${newId}:vendor:${index + 1}`,
    })),
    budget: {
      ...content.budget,
      items: content.budget.items.map((item, index) => ({
        ...item,
        id: `${newId}:cost:${index + 1}`,
        payments: item.payments.map((payment, paymentIndex) => ({
          ...payment,
          id: `${newId.slice(0, 64)}:cost:${index + 1}:payment:${paymentIndex + 1}`,
        })),
        sessionId: item.sessionId ? sessionIds.get(item.sessionId) ?? item.sessionId : null,
        vendorId: item.vendorId ? vendorIds.get(item.vendorId) ?? null : null,
      })),
    },
    preferences: content.preferences.map((preference, index) => ({
      ...preference,
      id: `${newId}:preference:${index + 1}`,
    })),
  });
}

export function reidentifyPlan(plan: SavedPlan, newId = makeId(), now = new Date().toISOString()): SavedPlan {
  const validated = validateSavedPlan(plan);
  return validateSavedPlan({
    ...validated,
    ...reidentifyContent(planContentOf(validated), newId),
    id: newId,
    createdAt: now,
    updatedAt: now,
    revisionHistory: validated.revisionHistory.map((entry) => {
      const suffix = `:revision:${entry.revisionNumber}`;
      return { ...entry, id: `${newId.slice(0, Math.max(1, 100 - suffix.length))}${suffix}` };
    }),
    undoRevision: validated.undoRevision ? {
      ...validated.undoRevision,
      acceptedAt: now,
      snapshot: reidentifyContent(validated.undoRevision.snapshot, newId),
    } : null,
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
  const reserveMinor = allocation.lines.find((line) => line.category === "contingency")?.amountMinor ?? 0;
  const forecasts = validated.budget.items.map((item) => ({
    item,
    forecast: forecastCostItem(item, expectedGuestsForCostItem(validated, item)),
  }));
  const known = forecasts.filter(({ forecast }) => forecast.lowerMinor !== null);
  const knownCostsMinor = safeMinor(known.reduce((sum, { forecast }) => sum + BigInt(forecast.lowerMinor ?? 0), 0n));
  const knownCostsMaxMinor = safeMinor(known.reduce((sum, { forecast }) => sum + BigInt(forecast.upperMinor ?? 0), 0n));
  const committed = forecasts.filter(({ item }) => item.evidence === "committed");
  const committedMinor = safeMinor(committed.reduce((sum, { forecast }) => sum + BigInt(forecast.lowerMinor ?? 0), 0n));
  const paidMinor = safeMinor(validated.budget.items.reduce((sum, item) => sum + BigInt(item.paidMinor), 0n));
  const committedPaidMinor = safeMinor(committed.reduce((sum, { item }) => sum + BigInt(item.paidMinor), 0n));
  const unresolved = validated.budget.items.filter((item) => item.amountMinor === null);
  const unresolvedMandatoryChargeCount = validated.budget.items.filter((item) => item.mandatory
    && item.amountMinor !== null
    && (!item.chargesReviewed
      || (item.feesIncluded !== true && !item.adjustments.some((adjustment) => adjustment.kind === "fee"))
      || (item.taxesIncluded !== true && !item.adjustments.some((adjustment) => adjustment.kind === "tax")))).length;
  const forecastWithReserveMinor = safeMinor(BigInt(knownCostsMinor) + BigInt(reserveMinor));
  const forecastWithReserveMaxMinor = safeMinor(BigInt(knownCostsMaxMinor) + BigInt(reserveMinor));
  const state = forecastWithReserveMinor > validated.budget.capMinor
    ? "over_cap"
    : forecastWithReserveMaxMinor > validated.budget.capMinor
      ? "range_crosses_cap"
      : (!validated.budget.reviewComplete || unresolved.some((item) => item.mandatory) || unresolvedMandatoryChargeCount > 0)
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
    unresolvedMandatoryChargeCount,
    state,
  };
}

export function makeId(): string {
  return globalThis.crypto.randomUUID();
}

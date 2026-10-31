import { capturePlanContent } from "./plan-content.ts";
import { normalizedPlanLabel, scopedPlanId } from "./plan-record-primitives.ts";
import {
  MAX_GENERATION_BODY_BYTES,
  MAX_REVISION_REQUESTS,
  MAX_REVISION_REQUEST_CHARACTERS,
} from "./planning-limits.ts";
import {
  buildPlanResult,
  parseBudgetMinor,
  type EventBrief,
  type PlannerProposal,
} from "./planner.ts";
import {
  expectedGuestsForCostItem,
  validateSavedPlan,
  type SavedPlan,
  type TaskRecord,
  type VendorRecord,
} from "./plan-store.ts";

import { diffPlanRevision, type RevisionChange } from "./plan-revision-diff.ts";
export { diffPlanRevision } from "./plan-revision-diff.ts";
export type { RevisionChange } from "./plan-revision-diff.ts";

export type PendingPlanRevision = {
  basePlan: SavedPlan;
  candidatePlan: SavedPlan;
  request: string;
  changes: RevisionChange[];
};

const MAX_REVISION_CONTEXT_BODY_BYTES = MAX_GENERATION_BODY_BYTES - 1024;

export function revisionGenerationRequest(
  brief: EventBrief,
  priorRequests: string[],
  revisionRequest: string,
) {
  const payload = {
    brief,
    priorRevisionRequests: [...priorRequests],
    revisionRequest,
  };
  while (
    payload.priorRevisionRequests.length > 0 &&
    new TextEncoder().encode(JSON.stringify(payload)).byteLength >
      MAX_REVISION_CONTEXT_BODY_BYTES
  ) {
    payload.priorRevisionRequests.shift();
  }
  return payload;
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function revisionChildId(
  planId: string,
  revision: number,
  kind: "task" | "vendor" | "cost",
  index: number,
  used: Set<string>,
): string {
  let attempt = 0;
  while (true) {
    const suffix = `:r${revision}:${kind}:${index + 1}${attempt ? `:${attempt}` : ""}`;
    const candidate = scopedPlanId(planId, suffix);
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    attempt += 1;
  }
}

function revisionEntryId(planId: string, revision: number): string {
  const suffix = `:revision:${revision}`;
  return scopedPlanId(planId, suffix);
}

function hasProgress(task: TaskRecord): boolean {
  return (
    task.status !== "todo" ||
    task.ownerLabel !== "Host" ||
    task.dueDate !== null ||
    task.relativeOffsetDays !== null ||
    task.dependencyIds.length > 0
  );
}

function hasVendorWork(
  vendor: VendorRecord,
  referencedByCost: boolean,
): boolean {
  return (
    referencedByCost ||
    vendor.name !== null ||
    vendor.availability !== "unknown" ||
    vendor.booking !== "not_booked" ||
    vendor.checkedAt !== null ||
    vendor.notes.trim().length > 0
  );
}

export function acceptPlanRevision(
  baseInput: SavedPlan,
  currentInput: SavedPlan,
  candidateInput: SavedPlan,
  requestInput: string,
  acceptedAt = new Date().toISOString(),
): SavedPlan {
  const base = validateSavedPlan(baseInput);
  const current = validateSavedPlan(currentInput);
  const candidate = validateSavedPlan(candidateInput);
  const request = requestInput.trim();

  if (base.id !== current.id || base.id !== candidate.id)
    throw new Error(
      "This revision belongs to a different plan. Discard it and create a new revision.",
    );
  if (current.updatedAt !== base.updatedAt || !same(current, base)) {
    throw new Error(
      "This plan changed while the revision was being drafted. Your edits are safe; discard this stale revision and create a fresh one.",
    );
  }
  if (candidate.planBrief.eventType !== current.planBrief.eventType)
    throw new Error(
      "Event type changes need a separate plan. Create a new plan to switch event types.",
    );
  if (candidate.planBrief.currency !== current.budget.currency)
    throw new Error(
      "Currency changes need a separate plan so recorded costs are never reinterpreted.",
    );
  const candidateSessionIds = new Set(
    candidate.planBrief.sessions.map((session) => session.id),
  );
  const removedSessionIds = new Set(
    current.planBrief.sessions
      .map((session) => session.id)
      .filter((sessionId) => !candidateSessionIds.has(sessionId)),
  );
  if (removedSessionIds.size > 0) {
    const hasLinkedCosts = current.budget.items.some(
      (item) => item.sessionId && removedSessionIds.has(item.sessionId),
    );
    const hasSavedAttendance = current.sessionAttendance.some(
      (attendance) =>
        removedSessionIds.has(attendance.sessionId) &&
        attendance.confirmedGuests !== null,
    );
    const hasPreservedTasks = current.tasks.some(
      (task) =>
        task.sessionId &&
        removedSessionIds.has(task.sessionId) &&
        (current.manualTaskIds.includes(task.id) || hasProgress(task)),
    );
    if (hasLinkedCosts || hasSavedAttendance || hasPreservedTasks) {
      throw new Error(
        "A removed session still has recorded costs, attendance, or task work. Reassign or clear that work before accepting this revision.",
      );
    }
  }
  if (request.length < 8 || request.length > MAX_REVISION_REQUEST_CHARACTERS)
    throw new Error("Describe the requested change in 8 to 500 characters.");
  if (current.revisionNumber >= 100)
    throw new Error(
      "This plan has reached the supported revision limit. Export it and start a new plan.",
    );

  const revisionNumber = current.revisionNumber + 1;
  const usedTaskIds = new Set(current.tasks.map((task) => task.id));
  const preservedTaskIds = new Set(current.manualTaskIds);
  current.tasks.forEach((task) => {
    if (hasProgress(task)) preservedTaskIds.add(task.id);
  });
  if (current.tasks.some((task) => task.dependencyIds.length > 0))
    current.tasks.forEach((task) => preservedTaskIds.add(task.id));

  const tasks: TaskRecord[] = [];
  const candidateTaskIdMap = new Map<string, string>();
  const matchedTaskIds = new Set<string>();
  candidate.tasks.forEach((proposedTask, index) => {
    const previousInScope = current.tasks.find(
      (task) =>
        !matchedTaskIds.has(task.id) &&
        task.sessionId === proposedTask.sessionId &&
        normalizedPlanLabel(task.title) ===
          normalizedPlanLabel(proposedTask.title),
    );
    const preservedTitleMatches = previousInScope
      ? []
      : current.tasks.filter(
          (task) =>
            !matchedTaskIds.has(task.id) &&
            preservedTaskIds.has(task.id) &&
            normalizedPlanLabel(task.title) ===
              normalizedPlanLabel(proposedTask.title),
        );
    const previous =
      previousInScope ??
      (preservedTitleMatches.length === 1
        ? preservedTitleMatches[0]
        : undefined);
    if (previous) {
      matchedTaskIds.add(previous.id);
      candidateTaskIdMap.set(proposedTask.id, previous.id);
      tasks.push(
        preservedTaskIds.has(previous.id)
          ? previous
          : {
              ...proposedTask,
              id: previous.id,
              status: previous.status,
              ownerLabel: previous.ownerLabel,
              dueDate: previous.dueDate,
              relativeOffsetDays: previous.relativeOffsetDays,
              dependencyIds: previous.dependencyIds,
            },
      );
      return;
    }
    const id = revisionChildId(
      current.id,
      revisionNumber,
      "task",
      index,
      usedTaskIds,
    );
    candidateTaskIdMap.set(proposedTask.id, id);
    tasks.push({ ...proposedTask, id, dependencyIds: [] });
  });
  const retainedTasks = current.tasks.filter(
    (task) => preservedTaskIds.has(task.id) && !matchedTaskIds.has(task.id),
  );
  tasks.push(...retainedTasks);
  if (tasks.length > 40)
    throw new Error(
      "This revision would exceed the 40-task limit because of preserved work. Keep this plan and remove completed or obsolete tasks before retrying.",
    );
  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];
    if (!preservedTaskIds.has(task.id)) {
      const proposed = candidate.tasks.find(
        (candidateTask) => candidateTaskIdMap.get(candidateTask.id) === task.id,
      );
      if (proposed)
        task.dependencyIds = proposed.dependencyIds.map(
          (dependencyId) =>
            candidateTaskIdMap.get(dependencyId) ?? dependencyId,
        );
    }
  }

  const usedVendorIds = new Set(current.vendors.map((vendor) => vendor.id));
  const linkedVendorIds = new Set(
    current.budget.items.flatMap((item) =>
      item.vendorId ? [item.vendorId] : [],
    ),
  );
  const vendors: VendorRecord[] = [];
  const candidateVendorIdMap = new Map<string, string>();
  const matchedVendorIds = new Set<string>();
  candidate.vendors.forEach((proposedVendor, index) => {
    const previous = current.vendors.find(
      (vendor) =>
        !matchedVendorIds.has(vendor.id) &&
        normalizedPlanLabel(vendor.category) ===
          normalizedPlanLabel(proposedVendor.category),
    );
    if (previous) {
      matchedVendorIds.add(previous.id);
      candidateVendorIdMap.set(proposedVendor.id, previous.id);
      vendors.push({
        ...proposedVendor,
        ...previous,
        id: previous.id,
        category: proposedVendor.category,
        questions: proposedVendor.questions,
      });
      return;
    }
    const id = revisionChildId(
      current.id,
      revisionNumber,
      "vendor",
      index,
      usedVendorIds,
    );
    candidateVendorIdMap.set(proposedVendor.id, id);
    vendors.push({ ...proposedVendor, id });
  });
  const retainedVendors = current.vendors.filter(
    (vendor) =>
      !matchedVendorIds.has(vendor.id) &&
      hasVendorWork(vendor, linkedVendorIds.has(vendor.id)),
  );
  vendors.push(...retainedVendors);
  if (vendors.length > 30)
    throw new Error(
      "This revision would exceed the 30-vendor limit because of preserved vendor records. Keep this plan and remove obsolete vendor records before retrying.",
    );

  // Existing records already reference stable current-plan IDs. Only candidate rows
  // need translating; reusing candidate IDs here can silently link a quote to a
  // different category when the generated checklist order changes.
  const budgetItems = current.budget.items.map((item) => ({ ...item }));
  const linkedMergedVendorIds = new Set(
    budgetItems.flatMap((item) => (item.vendorId ? [item.vendorId] : [])),
  );
  const presentCostScopes = new Set(
    budgetItems.map((item) => `${item.category}:${item.sessionId ?? "shared"}`),
  );
  const usedCostIds = new Set(budgetItems.map((item) => item.id));
  const newCostItems: typeof budgetItems = [];
  candidate.budget.items.forEach((item, index) => {
    const vendorId = item.vendorId
      ? (candidateVendorIdMap.get(item.vendorId) ?? null)
      : null;
    const costScope = `${item.category}:${item.sessionId ?? "shared"}`;
    if (
      !vendorId ||
      linkedMergedVendorIds.has(vendorId) ||
      presentCostScopes.has(costScope) ||
      budgetItems.length + newCostItems.length >= 100
    )
      return;
    presentCostScopes.add(costScope);
    linkedMergedVendorIds.add(vendorId);
    newCostItems.push({
      ...item,
      id: revisionChildId(
        current.id,
        revisionNumber,
        "cost",
        index,
        usedCostIds,
      ),
      vendorId,
    });
  });

  const proposal = { ...candidate.proposal } as PlannerProposal;
  const preservedSections: string[] = [];
  const proposalLabels: Record<
    (typeof current.manualProposalFields)[number],
    string
  > = {
    conceptTitle: "your edited plan title",
    overview: "your edited overview",
    theme: "your edited theme",
  };
  for (const field of current.manualProposalFields) {
    proposal[field] = current.proposal[field] as never;
    preservedSections.push(proposalLabels[field]);
  }

  const revisionChanges = diffPlanRevision(base, candidate);
  const changedSections = revisionChanges
    .map((change) => change.title)
    .slice(0, 12);
  if (current.manualTaskIds.length > 0 || retainedTasks.length > 0)
    preservedSections.push(
      "task progress, owners, due dates, and manually edited tasks",
    );
  if (
    current.vendors.some((vendor) =>
      hasVendorWork(vendor, linkedVendorIds.has(vendor.id)),
    )
  )
    preservedSections.push("vendor names, status, bookings, and notes");
  if (current.budget.items.length > 0)
    preservedSections.push("recorded cost lines and payment amounts");
  if (
    current.guestSummary.confirmed !== null ||
    current.guestSummary.adultCount !== null ||
    current.guestSummary.childCount !== null
  )
    preservedSections.push("guest counts");
  if (current.preferences.length > 0)
    preservedSections.push("host preferences");

  const candidatePreferencesById = new Map(
    candidate.preferences.map((preference) => [preference.id, preference]),
  );
  const preferences = [
    ...candidate.preferences.map((preference) => {
      const previous = current.preferences.find(
        (item) => item.id === preference.id,
      );
      return previous
        ? { ...preference, confirmed: previous.confirmed }
        : preference;
    }),
    ...current.preferences.filter(
      (preference) => !candidatePreferencesById.has(preference.id),
    ),
  ];
  const nextBudget = parseBudgetMinor(
    candidate.planBrief.budgetAmount,
    candidate.planBrief.currency,
  );
  const budgetCapChanged = nextBudget !== current.budget.capMinor;
  const budgetPrioritiesChanged = !same(
    current.proposal.budgetAllocations,
    candidate.proposal.budgetAllocations,
  );
  const billedCostQuantityChanged = current.budget.items.some((item) => {
    if (item.pricingModel !== "per_guest") return false;
    const minimum = item.minimumGuestCount ?? 0;
    const currentQuantity = Math.max(
      expectedGuestsForCostItem(current, item),
      minimum,
    );
    const candidateQuantity = Math.max(
      expectedGuestsForCostItem(candidate, item),
      minimum,
    );
    return currentQuantity !== candidateQuantity;
  });
  const merged = validateSavedPlan({
    ...current,
    updatedAt: acceptedAt,
    revisionNumber,
    undoRevision: {
      acceptedAt,
      revisionNumber,
      snapshot: capturePlanContent(current),
    },
    revisionHistory: [
      ...current.revisionHistory,
      {
        id: revisionEntryId(current.id, revisionNumber),
        baseRevisionNumber: current.revisionNumber,
        revisionNumber,
        request,
        acceptedAt,
        changedSections,
        preservedSections: [...new Set(preservedSections)].slice(0, 12),
      },
    ].slice(-MAX_REVISION_REQUESTS),
    draftBrief: candidate.draftBrief,
    planBrief: candidate.planBrief,
    proposal,
    origin: "ai",
    edited:
      current.edited ||
      current.manualProposalFields.length > 0 ||
      current.manualTaskIds.length > 0,
    tasks,
    vendors,
    budget: {
      ...current.budget,
      currency: candidate.budget.currency,
      capMinor: nextBudget,
      reviewComplete:
        current.budget.reviewComplete &&
        !budgetCapChanged &&
        !budgetPrioritiesChanged &&
        !billedCostQuantityChanged &&
        newCostItems.length === 0,
      items: [...budgetItems, ...newCostItems],
    },
    guestSummary: {
      ...current.guestSummary,
      expected: candidate.guestSummary.expected,
    },
    sessionAttendance: candidate.sessionAttendance.map((attendance) => ({
      ...attendance,
      confirmedGuests:
        current.sessionAttendance.find(
          (saved) => saved.sessionId === attendance.sessionId,
        )?.confirmedGuests ?? attendance.confirmedGuests,
    })),
    preferences,
    manualProposalFields: current.manualProposalFields,
    manualTaskIds: [
      ...new Set(
        tasks
          .filter((task) => preservedTaskIds.has(task.id))
          .map((task) => task.id),
      ),
    ],
  });
  buildPlanResult(
    merged.proposal,
    merged.budget.currency,
    merged.budget.capMinor,
  );
  return merged;
}

export function restorePreviousPlanRevision(
  planInput: SavedPlan,
  restoredAt = new Date().toISOString(),
): SavedPlan {
  const current = validateSavedPlan(planInput);
  const undoRevision = current.undoRevision;
  if (!undoRevision)
    throw new Error("There is no accepted revision to restore.");
  if (
    current.updatedAt !== undoRevision.acceptedAt ||
    current.revisionNumber !== undoRevision.revisionNumber
  ) {
    throw new Error(
      "This plan has changed since that revision was accepted. Your edits are safe; create a fresh revision instead of restoring over them.",
    );
  }
  if (current.revisionNumber >= 100)
    throw new Error(
      "This plan has reached the supported revision limit. Export it and start a new plan.",
    );

  const revisionNumber = current.revisionNumber + 1;
  const undoSnapshot = capturePlanContent(current);
  const restoredContent = validateSavedPlan({
    ...current,
    ...undoRevision.snapshot,
    updatedAt: restoredAt,
    revisionNumber,
    undoRevision: {
      acceptedAt: restoredAt,
      revisionNumber,
      snapshot: undoSnapshot,
    },
  });
  const changedSections = diffPlanRevision(current, restoredContent)
    .map((change) => change.title)
    .slice(0, 12);
  return validateSavedPlan({
    ...restoredContent,
    revisionHistory: [
      ...current.revisionHistory,
      {
        id: revisionEntryId(current.id, revisionNumber),
        baseRevisionNumber: current.revisionNumber,
        revisionNumber,
        request: "Restore the previous accepted plan",
        acceptedAt: restoredAt,
        changedSections,
        preservedSections: [
          "the plan state from before the last accepted revision",
        ],
      },
    ].slice(-MAX_REVISION_REQUESTS),
  });
}

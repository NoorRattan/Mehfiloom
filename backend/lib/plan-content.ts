import type { PlanRevisionSnapshot } from "./plan-store.ts";

/** The content changed by a revision, excluding identity and revision metadata. */
export function capturePlanContent(
  plan: PlanRevisionSnapshot,
): PlanRevisionSnapshot {
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

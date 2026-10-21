import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBudgetHealth,
  createSavedPlan,
  expectedGuestsForCostItem,
  forecastCostItem,
  reidentifyPlan,
  savedPlanSchema,
  validateSavedPlan,
} from "../lib/plan-store.ts";
import { EXAMPLE_BRIEF, EXAMPLE_PROPOSAL, getEventTemplateProposal, parseBudgetMinor } from "../lib/planner.ts";
import {
  acceptPlanRevision,
  diffPlanRevision,
  restorePreviousPlanRevision,
} from "../lib/plan-revisions.ts";

const CREATED_AT = "2026-10-20T12:00:00.000Z";
const EDITED_AT = "2026-10-20T12:05:00.000Z";
const GENERATED_AT = "2026-10-20T12:10:00.000Z";
const ACCEPTED_AT = "2026-10-20T12:15:00.000Z";

function makeEditedPlan() {
  const base = createSavedPlan(EXAMPLE_BRIEF, EXAMPLE_BRIEF, EXAMPLE_PROPOSAL, "revision-plan", CREATED_AT, "ai");
  const firstTask = base.tasks[0];
  return validateSavedPlan({
    ...base,
    updatedAt: EDITED_AT,
    edited: true,
    manualProposalFields: ["conceptTitle"],
    manualTaskIds: [firstTask.id],
    proposal: { ...base.proposal, conceptTitle: "The host's chosen celebration" },
    tasks: base.tasks.map((task, index) => index === 0
      ? { ...task, status: "done", ownerLabel: "Family team", dueDate: "2026-12-10" }
      : index === 1
        ? { ...task, relativeOffsetDays: -7 }
      : task),
    vendors: base.vendors.map((vendor, index) => index === 0
      ? { ...vendor, name: "Host-selected venue", availability: "confirmed", booking: "host_recorded", checkedAt: EDITED_AT, notes: "Accessibility details confirmed by host." }
      : vendor),
    budget: {
      ...base.budget,
      reviewComplete: true,
      items: base.budget.items.map((item, index) => index === 0
        ? { ...item, amountMinor: 100_000, evidence: "committed", paidMinor: 25_000, payments: [{ id: "venue-deposit", amountMinor: 25_000, paidAt: "2026-10-20", note: "Host-recorded deposit" }], mandatory: true, feesIncluded: true, sourceNote: "Host-entered venue commitment." }
        : item),
    },
    guestSummary: { ...base.guestSummary, confirmed: 47, adultCount: 44, childCount: 3 },
    preferences: base.preferences.map((preference, index) => index === 0 ? { ...preference, confirmed: false } : preference),
  });
}

function makeCandidate(current, overrides = {}) {
  const brief = {
    ...current.planBrief,
    guestCount: 40,
    budgetAmount: "50000",
    style: "A smaller, quieter gathering with flexible participation.",
    ...overrides,
  };
  const proposal = structuredClone(EXAMPLE_PROPOSAL);
  proposal.conceptTitle = "A calmer gathering in the garden";
  proposal.overview = "A smaller celebration with a calm arrival, welcoming shared meal, and a flexible pace for guests.";
  proposal.budgetAllocations[0] = { ...proposal.budgetAllocations[0], weight: proposal.budgetAllocations[0].weight + 1 };
  proposal.timeline[0] = { ...proposal.timeline[0], timing: "At the next planning milestone" };
  proposal.vendorChecklist[0] = {
    ...proposal.vendorChecklist[0],
    questions: proposal.vendorChecklist[0].questions.map((question, index) => index === 0 ? "Can you confirm the revised guest capacity?" : question),
  };
  return createSavedPlan(brief, brief, proposal, current.id, GENERATED_AT, "ai");
}

test("revision diff explains changed brief, priorities, timeline, vendors, and direction", () => {
  const current = makeEditedPlan();
  const candidate = makeCandidate(current);
  const changes = diffPlanRevision(current, candidate);
  const titles = changes.map((change) => change.title);

  assert.ok(titles.includes("Event brief"));
  assert.ok(titles.includes("Plan direction"));
  assert.ok(titles.includes("Budget priorities"));
  assert.ok(titles.includes("Timeline suggestions"));
  assert.ok(titles.includes("Vendor checklist"));
  assert.match(changes.find((change) => change.title === "Event brief").detail, /Guest count/);
  assert.match(changes.find((change) => change.title === "Event brief").detail, /Budget cap/);
  assert.match(changes.find((change) => change.title === "Budget priorities").detail, /relative-weight categories|weight .*→/i);
  assert.match(changes.find((change) => change.title === "Timeline suggestions").detail, /Timing or priority changed/);
  assert.match(changes.find((change) => change.title === "Vendor checklist").detail, /Questions revised/);
});

test("revision diff treats the same task in different sessions as a changed scope", () => {
  const sessions = [
    { id: "session-first", name: "First function", date: "", guestCount: 40 },
    { id: "session-second", name: "Second function", date: "", guestCount: 60 },
  ];
  const brief = { ...EXAMPLE_BRIEF, sessions };
  const baseProposal = structuredClone(EXAMPLE_PROPOSAL);
  baseProposal.timeline[0].sessionId = sessions[0].id;
  const candidateProposal = structuredClone(baseProposal);
  candidateProposal.timeline[0].sessionId = sessions[1].id;
  const base = createSavedPlan(brief, brief, baseProposal, "session-diff-plan", CREATED_AT, "ai");
  const candidate = createSavedPlan(brief, brief, candidateProposal, base.id, GENERATED_AT, "ai");
  const timeline = diffPlanRevision(base, candidate).find((change) => change.title === "Timeline suggestions");

  assert.match(timeline.detail, /Added 1/);
  assert.match(timeline.detail, /Removed 1/);
});

test("accepting a revision recalculates the cap and carries host work forward", () => {
  const current = makeEditedPlan();
  const candidate = makeCandidate(current);
  const revised = acceptPlanRevision(current, current, candidate, "We have fewer guests and need a more relaxed plan.", ACCEPTED_AT);
  const revisedTask = revised.tasks.find((task) => task.id === current.tasks[0].id);
  const revisedVendor = revised.vendors.find((vendor) => vendor.id === current.vendors[0].id);
  const revisedCost = revised.budget.items.find((item) => item.id === current.budget.items[0].id);

  assert.equal(revised.revisionNumber, 1);
  assert.equal(revised.updatedAt, ACCEPTED_AT);
  assert.equal(revised.planBrief.guestCount, 40);
  assert.equal(revised.guestSummary.expected, 40);
  assert.equal(revised.guestSummary.confirmed, 47);
  assert.equal(revised.guestSummary.adultCount, 44);
  assert.equal(revised.proposal.conceptTitle, "The host's chosen celebration");
  assert.equal(revised.proposal.overview, candidate.proposal.overview);
  assert.equal(revisedTask.status, "done");
  assert.equal(revisedTask.ownerLabel, "Family team");
  assert.equal(revisedTask.dueDate, "2026-12-10");
  assert.equal(revisedTask.relativeOffsetDays, null);
  assert.equal(revised.tasks.find((task) => task.id === current.tasks[1].id).relativeOffsetDays, -7, "relative task offsets survive an accepted revision even when the task was not otherwise edited");
  assert.equal(revisedTask.timing, current.tasks[0].timing, "a manually preserved task remains intact alongside the new proposal");
  assert.equal(revisedVendor.name, "Host-selected venue");
  assert.equal(revisedVendor.availability, "confirmed");
  assert.equal(revisedVendor.booking, "host_recorded");
  assert.equal(revisedVendor.notes, "Accessibility details confirmed by host.");
  assert.equal(revisedCost.amountMinor, 100_000);
  assert.equal(revisedCost.paidMinor, 25_000);
  assert.equal(revisedCost.evidence, "committed");
  assert.equal(revised.budget.capMinor, parseBudgetMinor("50000", "INR"));
  assert.equal(revised.budget.reviewComplete, false);
  assert.equal(revised.preferences[0].confirmed, false);
  assert.equal(revised.revisionHistory[0].request, "We have fewer guests and need a more relaxed plan.");
  assert.ok(revised.undoRevision);
  assert.deepEqual(validateSavedPlan(revised), revised);
});

test("generated listing hours do not upgrade vendor availability during revision", () => {
  const current = createSavedPlan(EXAMPLE_BRIEF, EXAMPLE_BRIEF, EXAMPLE_PROPOSAL, "listing-hours-revision", CREATED_AT, "ai");
  const proposal = structuredClone(EXAMPLE_PROPOSAL);
  proposal.vendorChecklist[0] = {
    ...proposal.vendorChecklist[0],
    questions: [
      "The listing reports Wednesday to Sunday hours; can you confirm 2027-02-14 availability?",
      "What capacity and access arrangements can the venue confirm?",
      "Which hire costs, deposits, and cancellation terms apply?",
    ],
  };
  proposal.ideas[0] = {
    ...proposal.ideas[0],
    costNote: "Listed hours are 9 a.m. to 5 p.m.; availability for the event date is still unknown.",
  };
  const candidate = createSavedPlan(current.planBrief, current.planBrief, proposal, current.id, GENERATED_AT, "ai");

  const revised = acceptPlanRevision(current, current, candidate, "Account for the venue listing hours.", ACCEPTED_AT);
  const venue = revised.vendors.find((vendor) => vendor.category === "Venue");

  assert.match(revised.proposal.ideas[0].costNote, /availability.*still unknown/);
  assert.equal(venue.availability, "unknown");
  assert.equal(venue.checkedAt, null);
});

test("reordering suggested vendors never moves an existing cost to a different vendor category", () => {
  const current = makeEditedPlan();
  const reorderedProposal = structuredClone(EXAMPLE_PROPOSAL);
  reorderedProposal.vendorChecklist.reverse();
  const candidate = createSavedPlan(current.planBrief, current.planBrief, reorderedProposal, current.id, GENERATED_AT, "ai");
  const originalCost = current.budget.items[0];
  const originalVendor = current.vendors.find((vendor) => vendor.id === originalCost.vendorId);
  const revised = acceptPlanRevision(current, current, candidate, "Reorder the vendor checklist for a new review.", ACCEPTED_AT);
  const revisedCost = revised.budget.items.find((item) => item.id === originalCost.id);
  const revisedVendor = revised.vendors.find((vendor) => vendor.id === originalVendor.id);

  assert.equal(revisedCost.vendorId, originalVendor.id);
  assert.equal(revisedVendor.category, originalVendor.category);
});

test("changing allocation priorities reopens a previously completed budget review", () => {
  const current = makeEditedPlan();
  const candidate = makeCandidate(current, {
    guestCount: current.planBrief.guestCount,
    budgetAmount: current.planBrief.budgetAmount,
    style: current.planBrief.style,
  });
  const revised = acceptPlanRevision(current, current, candidate, "Adjust the relative budget priorities.", ACCEPTED_AT);

  assert.equal(revised.budget.capMinor, current.budget.capMinor);
  assert.notDeepEqual(revised.proposal.budgetAllocations, current.proposal.budgetAllocations);
  assert.equal(revised.budget.reviewComplete, false);
});

test("120-to-160 guest revisions recalculate quantity costs and expose the cap breach for every event type", () => {
  const hardRequirement = "Step-free route and an allergen-aware menu confirmed with the caterer.";
  const syntheticLines = [
    { id: "food", category: "food", label: "Meal per guest", amountMinor: 50_000, pricingModel: "per_guest" },
    { id: "venue", category: "venue", label: "Venue hire", amountMinor: 3_000_000, pricingModel: "fixed" },
    { id: "decor", category: "decor", label: "Decor", amountMinor: 1_200_000, pricingModel: "fixed" },
    { id: "sound", category: "entertainment", label: "Sound", amountMinor: 1_000_000, pricingModel: "fixed" },
    { id: "logistics", category: "logistics", label: "Logistics", amountMinor: 800_000, pricingModel: "fixed" },
    { id: "access", category: "accessibility", label: "Access provisions", amountMinor: 1_000_000, pricingModel: "fixed" },
  ];

  for (const eventType of ["wedding", "birthday", "community"]) {
    const brief = {
      ...EXAMPLE_BRIEF,
      eventType,
      eventName: "Synthetic " + eventType + " attendance fixture",
      guestCount: 120,
      budgetAmount: "150000",
      currency: "INR",
      mustHaves: hardRequirement,
    };
    const proposal = getEventTemplateProposal(eventType);
    const seed = createSavedPlan(brief, brief, proposal, "attendance-" + eventType, CREATED_AT, "ai");
    const current = validateSavedPlan({
      ...seed,
      edited: true,
      budget: {
        ...seed.budget,
        reviewComplete: true,
        items: [
          ...seed.budget.items,
          ...syntheticLines.map((line) => ({
            ...line,
            id: "fixture-" + eventType + "-" + line.id,
            vendorId: null,
            amountMaxMinor: null,
            evidence: "committed",
            paidMinor: 0,
            payments: [],
            mandatory: true,
            validUntil: null,
            minimumGuestCount: null,
            feesIncluded: true,
            taxesIncluded: true,
            chargesReviewed: true,
            exclusions: [],
            sourceNote: "Synthetic test fixture; not a market quote.",
          })),
        ],
      },
    });
    const revisedBrief = { ...brief, guestCount: 160 };
    const revisedProposal = structuredClone(proposal);
    revisedProposal.timeline[0] = {
      ...revisedProposal.timeline[0],
      timing: "Reconfirm after the updated attendance estimate",
    };
    const candidate = createSavedPlan(revisedBrief, revisedBrief, revisedProposal, current.id, GENERATED_AT, "ai");
    const revised = acceptPlanRevision(current, current, candidate, "Attendance has increased; update quantities and reassess the plan.", ACCEPTED_AT);
    const originalHealth = calculateBudgetHealth(current);
    const revisedHealth = calculateBudgetHealth(revised);

    assert.equal(originalHealth.knownCostsMinor, 13_000_000, eventType + ": original 120-guest amount");
    assert.equal(revisedHealth.knownCostsMinor, 15_000_000, eventType + ": revised 160-guest amount");
    assert.equal(revisedHealth.knownCostsMinor - originalHealth.knownCostsMinor, 2_000_000, eventType + ": only 40 extra meals add cost");
    assert.equal(originalHealth.state, "within_cap", eventType + ": 120-guest plan fits the synthetic cap");
    assert.equal(revisedHealth.state, "over_cap", eventType + ": 160-guest plan remains visibly infeasible");
    assert.equal(revised.guestSummary.expected, 160);
    assert.equal(revised.planBrief.mustHaves, hardRequirement);
    assert.equal(revised.preferences.find((preference) => preference.priority === "hard").statement, hardRequirement);
    assert.equal(revised.tasks[0].timing, "Reconfirm after the updated attendance estimate");

    for (const line of syntheticLines.filter((item) => item.pricingModel === "fixed")) {
      assert.equal(
        revised.budget.items.find((item) => item.id === "fixture-" + eventType + "-" + line.id).amountMinor,
        line.amountMinor,
        eventType + ": fixed " + line.category + " cost remains unchanged",
      );
    }
  }
});

test("changing one session attendance updates only its scoped variable costs and preserves other work", () => {
  const sessions = [
    { id: "session-welcome", name: "Welcome gathering", date: "2027-02-13", guestCount: 80 },
    { id: "session-main", name: "Main celebration", date: "2027-02-14", guestCount: 120 },
  ];
  const brief = { ...EXAMPLE_BRIEF, guestCount: 150, sessions };
  const proposal = structuredClone(EXAMPLE_PROPOSAL);
  proposal.timeline[0].sessionId = sessions[0].id;
  const seed = createSavedPlan(brief, brief, proposal, "session-revision", CREATED_AT, "ai");
  const cost = seed.budget.items[0];
  const current = validateSavedPlan({
    ...seed,
    tasks: seed.tasks.map((task, index) => index === 0 ? { ...task, status: "done", sessionId: sessions[0].id } : task),
    sessionAttendance: [
      { sessionId: sessions[0].id, confirmedGuests: 72 },
      { sessionId: sessions[1].id, confirmedGuests: 104 },
    ],
    budget: {
      ...seed.budget,
      items: [
        { ...cost, id: "welcome-meals", vendorId: null, sessionId: sessions[0].id, amountMinor: 100, pricingModel: "per_guest", evidence: "estimate" },
        { ...cost, id: "main-meals", vendorId: null, sessionId: sessions[1].id, amountMinor: 100, pricingModel: "per_guest", evidence: "estimate" },
        { ...cost, id: "shared-venue", vendorId: null, sessionId: null, amountMinor: 5000, pricingModel: "fixed", evidence: "estimate" },
      ],
    },
  });
  const revisedBrief = { ...brief, sessions: sessions.map((session, index) => index === 0 ? { ...session, guestCount: 100 } : session) };
  const revisedProposal = structuredClone(proposal);
  const candidate = createSavedPlan(revisedBrief, revisedBrief, revisedProposal, current.id, GENERATED_AT, "ai");
  const changes = diffPlanRevision(current, candidate);
  const revised = acceptPlanRevision(current, current, candidate, "Attendance changed for the welcome gathering; update the applicable plan lines.", ACCEPTED_AT);
  const welcomeMeals = revised.budget.items.find((item) => item.id === "welcome-meals");
  const mainMeals = revised.budget.items.find((item) => item.id === "main-meals");
  const venue = revised.budget.items.find((item) => item.id === "shared-venue");

  assert.ok(changes.some((change) => change.title === "Session attendance" && /80 → 100 expected/.test(change.detail)));
  assert.equal(revised.guestSummary.expected, 150, "session counts must not be added to the unique guest estimate");
  assert.equal(revised.sessionAttendance.find((item) => item.sessionId === sessions[0].id).confirmedGuests, 72);
  assert.equal(revised.sessionAttendance.find((item) => item.sessionId === sessions[1].id).confirmedGuests, 104);
  assert.equal(revised.tasks.find((task) => task.title === current.tasks[0].title).status, "done");
  assert.equal(expectedGuestsForCostItem(revised, welcomeMeals), 100);
  assert.equal(forecastCostItem(welcomeMeals, expectedGuestsForCostItem(revised, welcomeMeals)).lowerMinor, 10000);
  assert.equal(forecastCostItem(mainMeals, expectedGuestsForCostItem(revised, mainMeals)).lowerMinor, 12000);
  assert.equal(forecastCostItem(venue, expectedGuestsForCostItem(revised, venue)).lowerMinor, 5000);
});

test("a revision cannot remove a session that still has cost, attendance, or preserved task records", () => {
  const sessions = [{ id: "session-one", name: "Main gathering", date: "", guestCount: 40 }];
  const brief = { ...EXAMPLE_BRIEF, sessions };
  const proposal = structuredClone(EXAMPLE_PROPOSAL);
  proposal.timeline[0].sessionId = sessions[0].id;
  const seed = createSavedPlan(brief, brief, proposal, "session-removal", CREATED_AT, "ai");
  const current = validateSavedPlan({
    ...seed,
    tasks: seed.tasks.map((task, index) => index === 0 ? { ...task, sessionId: sessions[0].id, status: "done" } : task),
    sessionAttendance: [{ sessionId: sessions[0].id, confirmedGuests: 38 }],
  });
  const noSessionBrief = { ...brief, sessions: [] };
  const candidate = createSavedPlan(noSessionBrief, noSessionBrief, EXAMPLE_PROPOSAL, current.id, GENERATED_AT, "ai");

  assert.throws(
    () => acceptPlanRevision(current, current, candidate, "Remove the session that has already been planned.", ACCEPTED_AT),
    /reassign or clear that work/i,
  );
});

test("restoration creates a new monotonic revision and can toggle back", () => {
  const current = makeEditedPlan();
  const accepted = acceptPlanRevision(current, current, makeCandidate(current), "We have fewer guests and need a more relaxed plan.", ACCEPTED_AT);
  const restored = restorePreviousPlanRevision(accepted, "2026-10-20T12:20:00.000Z");

  assert.equal(restored.revisionNumber, 2);
  assert.equal(restored.proposal.conceptTitle, current.proposal.conceptTitle);
  assert.equal(restored.planBrief.guestCount, current.planBrief.guestCount);
  assert.equal(restored.revisionHistory.at(-1).request, "Restore the previous accepted plan");
  assert.equal(restored.updatedAt, "2026-10-20T12:20:00.000Z");

  const toggledBack = restorePreviousPlanRevision(restored, "2026-10-20T12:25:00.000Z");
  assert.equal(toggledBack.revisionNumber, 3);
  assert.equal(toggledBack.proposal.conceptTitle, accepted.proposal.conceptTitle);
  assert.equal(toggledBack.planBrief.guestCount, accepted.planBrief.guestCount);
});

test("stale revisions and restores after later edits cannot overwrite the plan", () => {
  const current = makeEditedPlan();
  const candidate = makeCandidate(current);
  const stale = validateSavedPlan({
    ...current,
    updatedAt: GENERATED_AT,
    proposal: { ...current.proposal, conceptTitle: "A newer host edit" },
  });

  assert.throws(
    () => acceptPlanRevision(current, stale, candidate, "We have fewer guests and need a more relaxed plan.", ACCEPTED_AT),
    /changed while the revision was being drafted/i,
  );
  assert.equal(current.proposal.conceptTitle, "The host's chosen celebration");

  const accepted = acceptPlanRevision(current, current, candidate, "We have fewer guests and need a more relaxed plan.", ACCEPTED_AT);
  const editedAfterAccept = validateSavedPlan({
    ...accepted,
    updatedAt: "2026-10-20T12:16:00.000Z",
    draftBrief: { ...accepted.draftBrief, location: "A newer host-entered location" },
  });
  assert.throws(() => restorePreviousPlanRevision(editedAfterAccept), /has changed since that revision/i);
});

test("event type and currency cannot be silently changed inside a revision", () => {
  const current = makeEditedPlan();
  const eventTypeCandidate = makeCandidate(current, { eventType: "community" });
  const currencyCandidate = makeCandidate(current, { currency: "USD", budgetAmount: "50000" });

  assert.throws(
    () => acceptPlanRevision(current, current, eventTypeCandidate, "We have fewer guests and need a more relaxed plan.", ACCEPTED_AT),
    /event type changes need a separate plan/i,
  );
  assert.throws(
    () => acceptPlanRevision(current, current, currencyCandidate, "We have fewer guests and need a more relaxed plan.", ACCEPTED_AT),
    /currency changes need a separate plan/i,
  );
});

test("importing a revised plan re-identifies its stored undo snapshot and links", () => {
  const current = makeEditedPlan();
  const accepted = acceptPlanRevision(current, current, makeCandidate(current), "We have fewer guests and need a more relaxed plan.", ACCEPTED_AT);
  const imported = reidentifyPlan(accepted, "copied-revision-plan", "2026-10-21T12:00:00.000Z");
  const snapshot = imported.undoRevision.snapshot;
  const taskIds = new Set(snapshot.tasks.map((task) => task.id));
  const vendorIds = new Set(snapshot.vendors.map((vendor) => vendor.id));

  assert.equal(imported.undoRevision.acceptedAt, imported.updatedAt);
  assert.ok(snapshot.tasks.every((task) => task.dependencyIds.every((id) => taskIds.has(id))));
  assert.ok(snapshot.budget.items.every((item) => !item.vendorId || vendorIds.has(item.vendorId)));
  assert.ok(snapshot.manualTaskIds.every((id) => taskIds.has(id)));
  assert.ok(snapshot.tasks.every((task) => !task.id.startsWith("revision-plan:")));
  assert.equal(restorePreviousPlanRevision(imported, "2026-10-21T12:05:00.000Z").proposal.conceptTitle, current.proposal.conceptTitle);
});

test("re-identifying a session-aware revision preserves links inside its undo snapshot", () => {
  const sessions = [{ id: "session-shared-id", name: "Family gathering", date: "2027-02-14", guestCount: 60 }];
  const brief = { ...EXAMPLE_BRIEF, guestCount: 60, sessions };
  const proposal = structuredClone(EXAMPLE_PROPOSAL);
  proposal.timeline[0].sessionId = sessions[0].id;
  const seed = createSavedPlan(brief, brief, proposal, "session-undo-source", CREATED_AT, "ai");
  const current = validateSavedPlan({
    ...seed,
    sessionAttendance: [{ sessionId: sessions[0].id, confirmedGuests: 55 }],
    budget: { ...seed.budget, items: seed.budget.items.map((item, index) => index === 0 ? { ...item, sessionId: sessions[0].id } : item) },
  });
  const candidate = createSavedPlan(brief, brief, proposal, current.id, GENERATED_AT, "ai");
  const accepted = acceptPlanRevision(current, current, candidate, "Refresh the session plan with the same attendance scope.", ACCEPTED_AT);
  const imported = reidentifyPlan(accepted, "session-undo-import", "2026-10-21T12:30:00.000Z");
  const snapshot = imported.undoRevision.snapshot;
  const sessionId = imported.planBrief.sessions[0].id;

  assert.equal(snapshot.planBrief.sessions[0].id, sessionId);
  assert.equal(snapshot.tasks[0].sessionId, sessionId);
  assert.equal(snapshot.budget.items[0].sessionId, sessionId);
  assert.equal(snapshot.sessionAttendance[0].sessionId, sessionId);
  assert.equal(snapshot.sessionAttendance[0].confirmedGuests, 55);
});

test("legacy saved plans receive safe revision defaults and conservatively preserve edited fields", () => {
  const legacy = { ...makeEditedPlan() };
  delete legacy.revisionNumber;
  delete legacy.revisionHistory;
  delete legacy.undoRevision;
  delete legacy.manualProposalFields;
  delete legacy.manualTaskIds;

  const migrated = savedPlanSchema.parse(legacy);

  assert.equal(migrated.revisionNumber, 0);
  assert.deepEqual(migrated.revisionHistory, []);
  assert.equal(migrated.undoRevision, null);
  assert.deepEqual(migrated.manualProposalFields, ["conceptTitle", "overview", "theme"]);
  assert.deepEqual(migrated.manualTaskIds, legacy.tasks.map((task) => task.id));
});

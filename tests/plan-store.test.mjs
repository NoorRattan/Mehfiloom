import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBudgetHealth,
  createSavedPlan,
  parsePlanDocument,
  parseWorkspaceJson,
  reidentifyPlan,
  serializePlanDocument,
  serializeWorkspace,
} from "../lib/plan-store.ts";
import { EXAMPLE_BRIEF, EXAMPLE_PROPOSAL } from "../lib/planner.ts";

const CREATED_AT = "2026-10-20T12:00:00.000Z";

function makePlan(id = "plan-one", eventName = EXAMPLE_BRIEF.eventName) {
  const brief = { ...EXAMPLE_BRIEF, eventName };
  return createSavedPlan(brief, brief, EXAMPLE_PROPOSAL, id, CREATED_AT);
}

test("versioned workspace save and reload preserves multiple complete plans", () => {
  const first = makePlan("plan-one", "Synthetic wedding");
  const second = makePlan("plan-two", "Synthetic community gathering");
  const workspace = {
    format: "mehfiloom-workspace",
    schemaVersion: 1,
    activePlanId: second.id,
    plans: [first, second],
  };

  const reloaded = parseWorkspaceJson(serializeWorkspace(workspace));

  assert.equal(reloaded.plans.length, 2);
  assert.equal(reloaded.activePlanId, second.id);
  assert.equal(reloaded.plans[0].draftBrief.eventName, "Synthetic wedding");
  assert.deepEqual(reloaded.plans[1].vendors, second.vendors);
  assert.deepEqual(reloaded.plans[1].tasks, second.tasks);
});

test("plan JSON export/import round-trips and re-identification preserves internal links", () => {
  const plan = makePlan();
  const imported = parsePlanDocument(serializePlanDocument(plan));
  const duplicate = reidentifyPlan(imported, "plan-imported", "2026-10-21T12:00:00.000Z");
  const vendorIds = new Set(duplicate.vendors.map((vendor) => vendor.id));

  assert.deepEqual(imported, plan);
  assert.notEqual(duplicate.id, plan.id);
  assert.ok(duplicate.budget.items.every((item) => !item.vendorId || vendorIds.has(item.vendorId)));
  assert.ok(duplicate.tasks.every((task) => task.dependencyIds.every((id) => duplicate.tasks.some((other) => other.id === id))));
  assert.equal(duplicate.createdAt, "2026-10-21T12:00:00.000Z");
});

test("older fixed-cost plan files default to fixed pricing without a range", () => {
  const document = JSON.parse(serializePlanDocument(makePlan()));
  for (const item of document.plan.budget.items) {
    delete item.pricingModel;
    delete item.amountMaxMinor;
  }

  const upgraded = parsePlanDocument(JSON.stringify(document));
  assert.ok(upgraded.budget.items.every((item) => item.pricingModel === "fixed" && item.amountMaxMinor === null));
});

test("import rejects malformed, oversized, unsupported, and broken-reference documents", () => {
  const document = JSON.parse(serializePlanDocument(makePlan()));

  assert.throws(() => parsePlanDocument("{"), /valid JSON/i);
  assert.throws(() => parsePlanDocument(" ".repeat(500_001)), /too large/i);
  assert.throws(() => parsePlanDocument(JSON.stringify({ ...document, schemaVersion: 99 })), /schemaVersion/i);

  const brokenReference = structuredClone(document);
  brokenReference.plan.budget.items[0].vendorId = "missing-vendor";
  assert.throws(() => parsePlanDocument(JSON.stringify(brokenReference)), /reference a vendor/i);
});

test("budget health keeps estimates, commitments, payments, and reserve distinct", () => {
  const plan = makePlan();
  const knownCost = {
    ...plan.budget.items[0],
    amountMinor: 20_000,
    evidence: "committed",
    paidMinor: 7_000,
    mandatory: true,
  };
  const withCommitment = {
    ...plan,
    budget: {
      ...plan.budget,
      items: [knownCost, ...plan.budget.items.slice(1).map((item, index) => ({
        ...item,
        mandatory: index === 0,
      }))],
      reviewComplete: true,
    },
  };
  const health = calculateBudgetHealth(withCommitment);

  assert.equal(health.knownCostsMinor, 20_000);
  assert.ok(health.reserveMinor > 0);
  assert.equal(health.forecastWithReserveMinor, 20_000 + health.reserveMinor);
  assert.equal(health.paidMinor, 7_000);
  assert.equal(health.outstandingCommittedMinor, 13_000);
  assert.equal(health.state, "unknown", "other mandatory costs remain unpriced");

  const resolved = {
    ...withCommitment,
    budget: {
      ...withCommitment.budget,
      items: withCommitment.budget.items.map((item) => ({
        ...item,
        mandatory: false,
      })),
    },
  };
  assert.equal(calculateBudgetHealth(resolved).state, "within_cap");
});

test("changing one estimate into a commitment does not add a second expense", () => {
  const plan = makePlan();
  const estimate = { ...plan.budget.items[0], amountMinor: 20_000, evidence: "estimate" };
  const committed = { ...estimate, evidence: "committed", paidMinor: 5_000 };
  const revised = {
    ...plan,
    budget: {
      ...plan.budget,
      reviewComplete: true,
      items: [committed, ...plan.budget.items.slice(1)],
    },
  };
  const health = calculateBudgetHealth(revised);

  assert.equal(revised.budget.items.length, plan.budget.items.length);
  assert.equal(health.knownCostsMinor, 20_000);
  assert.equal(health.paidMinor, 5_000);
  assert.equal(health.outstandingCommittedMinor, 15_000);
});

test("budget feasibility flags a recorded forecast above the cap", () => {
  const plan = makePlan();
  const expensive = {
    ...plan.budget.items[0],
    amountMinor: plan.budget.capMinor,
    evidence: "quote",
    mandatory: false,
  };
  const overCap = {
    ...plan,
    budget: { ...plan.budget, items: [expensive], reviewComplete: true },
  };

  assert.equal(calculateBudgetHealth(overCap).state, "over_cap");
});

test("per-guest quotes apply the greater of expected and minimum billable attendance", () => {
  const plan = makePlan();
  const perGuestQuote = {
    ...plan.budget.items[0],
    amountMinor: 500,
    amountMaxMinor: null,
    pricingModel: "per_guest",
    evidence: "quote",
    mandatory: true,
    minimumGuestCount: 150,
  };
  const priced = {
    ...plan,
    budget: { ...plan.budget, items: [perGuestQuote, ...plan.budget.items.slice(1)], reviewComplete: true },
  };
  const health = calculateBudgetHealth(priced);

  assert.equal(health.knownCostsMinor, 75_000, "the ₹500 rate uses the 150-person minimum, not the 120-person estimate");
  assert.equal(health.knownCostsMaxMinor, 75_000);
  assert.equal(health.forecastWithReserveMinor, 75_000 + health.reserveMinor);
  assert.equal(health.state, "within_cap");
});

test("a cost range that straddles the cap is not reported as affordable", () => {
  const plan = makePlan();
  const rangedQuote = {
    ...plan.budget.items[0],
    amountMinor: 22_500_000,
    amountMaxMinor: 24_000_000,
    evidence: "quote",
    mandatory: false,
  };
  const ranged = {
    ...plan,
    budget: { ...plan.budget, items: [rangedQuote], reviewComplete: true },
  };
  const health = calculateBudgetHealth(ranged);

  assert.ok(health.forecastWithReserveMinor < plan.budget.capMinor);
  assert.ok(health.forecastWithReserveMaxMinor > plan.budget.capMinor);
  assert.equal(health.state, "range_crosses_cap");
});

test("a marked-complete cost review still reports unresolved mandatory costs", () => {
  const plan = makePlan();
  const reviewed = {
    ...plan,
    budget: {
      ...plan.budget,
      reviewComplete: true,
      items: plan.budget.items.map((item, index) => ({ ...item, mandatory: index === 0 })),
    },
  };

  const health = calculateBudgetHealth(reviewed);
  assert.equal(health.unresolvedCount, reviewed.budget.items.length);
  assert.equal(health.unresolvedMandatoryCount, 1);
  assert.equal(health.state, "unknown");
});

test("mandatory fees with unknown inclusion prevent a green budget status", () => {
  const plan = makePlan();
  const mandatoryCost = {
    ...plan.budget.items[0],
    amountMinor: 10_000,
    evidence: "quote",
    mandatory: true,
    feesIncluded: null,
  };
  const withUnknownFees = {
    ...plan,
    budget: { ...plan.budget, items: [mandatoryCost, ...plan.budget.items.slice(1)], reviewComplete: true },
  };

  assert.equal(calculateBudgetHealth(withUnknownFees).unknownMandatoryFeeCount, 1);
  assert.equal(calculateBudgetHealth(withUnknownFees).state, "unknown");
  assert.equal(calculateBudgetHealth({
    ...withUnknownFees,
    budget: { ...withUnknownFees.budget, items: [{ ...mandatoryCost, feesIncluded: true }, ...withUnknownFees.budget.items.slice(1)] },
  }).state, "within_cap");
});

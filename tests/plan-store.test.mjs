import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_WORKSPACE_STORAGE_KEY,
  OLDEST_WORKSPACE_STORAGE_KEY,
  OLDER_WORKSPACE_STORAGE_KEY,
  WORKSPACE_STORAGE_KEY,
  WORKSPACE_VERSION,
  addCostPayment,
  canAddTaskDependency,
  canMarkTaskDone,
  canReopenTask,
  calculateBudgetHealth,
  costAdjustmentSchema,
  createSavedPlan,
  expectedGuestsForCostItem,
  forecastCostItem,
  parsePlanDocument,
  parseWorkspaceJson,
  reidentifyPlan,
  removeCostPayment,
  resolveTaskDate,
  SECOND_OLDER_WORKSPACE_STORAGE_KEY,
  savedPlanSchema,
  serializePlanDocument,
  serializeWorkspace,
  taskScheduleConflicts,
} from "../lib/plan-store.ts";
import { EXAMPLE_BRIEF, EXAMPLE_PROPOSAL, parseBudgetMinor } from "../lib/planner.ts";
import {
  clearWorkspaceStorage,
  loadWorkspaceFromStorage,
  saveWorkspaceToStorage,
} from "../lib/plan-storage.ts";

const CREATED_AT = "2026-10-20T12:00:00.000Z";

function makePlan(id = "plan-one", eventName = EXAMPLE_BRIEF.eventName) {
  const brief = { ...EXAMPLE_BRIEF, eventName };
  return createSavedPlan(brief, brief, EXAMPLE_PROPOSAL, id, CREATED_AT);
}

test("a vendor listing and opening hours do not confirm event-date availability", () => {
  const brief = {
    ...EXAMPLE_BRIEF,
    eventDate: "2027-02-14",
    style: "A venue directory lists Wednesday to Sunday hours from 9 a.m. to 5 p.m.; no one has asked about the event date.",
  };
  const proposal = structuredClone(EXAMPLE_PROPOSAL);
  proposal.vendorChecklist[0] = {
    ...proposal.vendorChecklist[0],
    category: "Venue listing",
    questions: [
      "The listing reports Wednesday to Sunday hours; is the venue available on 2027-02-14?",
      "What capacity and access arrangements can the venue confirm?",
      "Which hire costs, deposits, and cancellation terms apply?",
    ],
  };
  proposal.ideas[0] = {
    ...proposal.ideas[0],
    costNote: "Listed hours are 9 a.m. to 5 p.m.; this does not confirm availability for the event date.",
  };
  proposal.assumptions[1] = "A listing's opening hours are not confirmation that the venue is available for the event date.";

  const plan = createSavedPlan(brief, brief, proposal, "t006-listing-hours", CREATED_AT, "ai");

  assert.match(plan.proposal.ideas[0].costNote, /does not confirm availability/);
  assert.match(plan.proposal.assumptions[1], /not confirmation.*event date/i);
  assert.ok(plan.vendors.every((vendor) => vendor.availability === "unknown"));
  assert.ok(plan.vendors.every((vendor) => vendor.checkedAt === null));
  assert.ok(plan.vendors.every((vendor) => vendor.name === null && vendor.notes === ""));
});

test("task dependency editing prevents self-links, duplicates, and direct or transitive cycles", () => {
  const plan = makePlan();
  const tasks = plan.tasks.slice(0, 4).map((task) => ({ ...task, dependencyIds: [] }));
  tasks[1] = { ...tasks[1], dependencyIds: [tasks[0].id] };
  tasks[2] = { ...tasks[2], dependencyIds: [tasks[1].id] };

  assert.equal(canAddTaskDependency(tasks, tasks[0].id, tasks[0].id), false);
  assert.equal(canAddTaskDependency(tasks, tasks[0].id, "missing-task"), false);
  assert.equal(canAddTaskDependency(tasks, tasks[0].id, tasks[1].id), false, "a direct cycle is rejected");
  assert.equal(canAddTaskDependency(tasks, tasks[0].id, tasks[2].id), false, "a transitive cycle is rejected");
  assert.equal(canAddTaskDependency(tasks, tasks[1].id, tasks[0].id), false, "an existing link is not added twice");
  assert.equal(canAddTaskDependency(tasks, tasks[2].id, plan.tasks[3].id), true, "an independent prerequisite is allowed");
});

test("saved plans reject duplicate and circular task prerequisites", () => {
  const plan = makePlan();
  const [first, second, ...rest] = plan.tasks;
  const duplicate = {
    ...plan,
    tasks: [{ ...first, dependencyIds: [second.id, second.id] }, second, ...rest],
  };
  const circular = {
    ...plan,
    tasks: [
      { ...first, dependencyIds: [second.id] },
      { ...second, dependencyIds: [first.id] },
      ...rest,
    ],
  };
  const missing = {
    ...plan,
    tasks: [{ ...first, dependencyIds: ["missing-task"] }, second, ...rest],
  };

  assert.equal(savedPlanSchema.safeParse(duplicate).success, false);
  assert.equal(savedPlanSchema.safeParse(circular).success, false);
  assert.equal(savedPlanSchema.safeParse(missing).success, false);
  assert.throws(() => savedPlanSchema.parse(circular), /cannot contain a cycle/);
});

test("task completion follows prerequisites in both directions", () => {
  const plan = makePlan();
  const [first, second, third] = plan.tasks;
  let tasks = [
    { ...first, status: "todo", dependencyIds: [] },
    { ...second, status: "todo", dependencyIds: [first.id] },
    { ...third, status: "todo", dependencyIds: [second.id] },
  ];

  assert.equal(canMarkTaskDone(tasks[1], tasks), false);
  tasks = [{ ...tasks[0], status: "done" }, tasks[1], tasks[2]];
  assert.equal(canMarkTaskDone(tasks[1], tasks), true);
  tasks = [tasks[0], { ...tasks[1], status: "done" }, { ...tasks[2], status: "done" }];
  assert.equal(canReopenTask(tasks[0], tasks), false);
  assert.equal(canReopenTask(tasks[1], tasks), false);
  tasks = [tasks[0], tasks[1], { ...tasks[2], status: "todo" }];
  assert.equal(canReopenTask(tasks[1], tasks), true);
});

test("task schedule reports prerequisite and event-date conflicts", () => {
  const plan = makePlan();
  const [prerequisite, dependent, afterEvent] = plan.tasks;
  const tasks = [
    { ...prerequisite, dueDate: "2026-12-12", dependencyIds: [] },
    { ...dependent, dueDate: "2026-12-10", status: "done", dependencyIds: [prerequisite.id] },
    { ...afterEvent, dueDate: "2026-12-22", dependencyIds: [] },
    { ...plan.tasks[3], dueDate: "2026-12-09", status: "todo", dependencyIds: [] },
  ];

  const conflicts = taskScheduleConflicts(tasks, "2026-12-20", "2026-12-11");
  assert.deepEqual(conflicts.get(dependent.id), [`${prerequisite.title} is due 2026-12-12, after this task.`]);
  assert.deepEqual(conflicts.get(afterEvent.id), ["This task is due 2026-12-22, after the event date 2026-12-20."]);
  assert.deepEqual(conflicts.get(tasks[3].id), ["This task was due 2026-12-09 and is still open."]);
  assert.equal(taskScheduleConflicts(tasks, "", "2026-12-11").has(afterEvent.id), false, "a task date cannot be compared with an unknown event date");
});

test("relative task dates follow event or function calendar dates while fixed dates stay unchanged", () => {
  const plan = makePlan();
  const task = { ...plan.tasks[0], dueDate: null, relativeOffsetDays: -2, sessionId: null };
  const firstResolution = resolveTaskDate(task, "2027-03-15");
  assert.deepEqual(firstResolution, { anchorDate: "2027-03-15", relativeDate: "2027-03-13", fixedDate: null, dueDate: "2027-03-13" });
  assert.equal(resolveTaskDate(task, "2027-03-16").dueDate, "2027-03-14", "changing the event date moves only the relative target by a calendar day");

  const session = { id: "function-one", date: "2027-03-14" };
  const functionTask = { ...task, sessionId: session.id, relativeOffsetDays: 1 };
  assert.equal(resolveTaskDate(functionTask, "2027-03-20", [session]).dueDate, "2027-03-15", "function tasks use their assigned function date as the anchor");

  const fixedTask = { ...task, dueDate: "2027-03-11" };
  const fixedResolution = resolveTaskDate(fixedTask, "2027-03-15");
  assert.equal(fixedResolution.dueDate, "2027-03-11");
  assert.equal(fixedResolution.relativeDate, "2027-03-13");
  const conflicts = taskScheduleConflicts([fixedTask], "2027-03-15", "", []);
  assert.ok(conflicts.get(fixedTask.id).some((message) => message.includes("fixed due date remains 2027-03-11")));

  const unresolved = resolveTaskDate(functionTask, "2027-03-20", [{ id: session.id, date: "" }]);
  assert.equal(unresolved.dueDate, null);
  assert.equal(taskScheduleConflicts([functionTask], "2027-03-20", "", [{ id: session.id, date: "" }]).has(functionTask.id), true);
});

test("versioned workspace save and reload preserves multiple complete plans", () => {
  const first = makePlan("plan-one", "Synthetic wedding");
  const second = makePlan("plan-two", "Synthetic community gathering");
  const workspace = {
    format: "mehfiloom-workspace",
    schemaVersion: WORKSPACE_VERSION,
    activePlanId: second.id,
    plans: [first, second],
  };

  const reloaded = parseWorkspaceJson(serializeWorkspace(workspace));

  assert.equal(reloaded.plans.length, 2);
  assert.equal(reloaded.schemaVersion, WORKSPACE_VERSION);
  assert.equal(reloaded.activePlanId, second.id);
  assert.equal(reloaded.plans[0].draftBrief.eventName, "Synthetic wedding");
  assert.deepEqual(reloaded.plans[1].vendors, second.vendors);
  assert.deepEqual(reloaded.plans[1].tasks, second.tasks);
});

test("workspace persistence recovers after denied reads and quota failures", () => {
  const plan = makePlan();
  const workspace = {
    format: "mehfiloom-workspace",
    schemaVersion: WORKSPACE_VERSION,
    activePlanId: plan.id,
    plans: [plan],
  };
  const values = new Map();
  let readsDenied = false;
  let writesDenied = false;
  const storage = {
    getItem(key) {
      if (readsDenied) throw new Error("Storage access denied");
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (writesDenied) throw new Error("Quota exceeded");
      values.set(key, value);
    },
    removeItem(key) { values.delete(key); },
  };

  assert.equal(loadWorkspaceFromStorage(storage), null);
  saveWorkspaceToStorage(storage, workspace);
  assert.ok(values.has(WORKSPACE_STORAGE_KEY));
  assert.deepEqual(loadWorkspaceFromStorage(storage), workspace);
  const changedPlan = { ...plan, draftBrief: { ...plan.draftBrief, eventName: "Updated synthetic plan" } };
  const changedWorkspace = { ...workspace, plans: [changedPlan] };
  writesDenied = true;
  assert.throws(() => saveWorkspaceToStorage(storage, changedWorkspace), /Quota exceeded/);
  assert.equal(loadWorkspaceFromStorage(storage).plans[0].draftBrief.eventName, plan.draftBrief.eventName);
  writesDenied = false;
  saveWorkspaceToStorage(storage, changedWorkspace);
  assert.equal(loadWorkspaceFromStorage(storage).plans[0].draftBrief.eventName, "Updated synthetic plan");
  readsDenied = true;
  assert.throws(() => loadWorkspaceFromStorage(storage), /Storage access denied/);
  readsDenied = false;
  assert.deepEqual(loadWorkspaceFromStorage(storage), changedWorkspace);
  clearWorkspaceStorage(storage);
  assert.equal(loadWorkspaceFromStorage(storage), null);
});

test("legacy v1 browser storage migrates saved totals into dated-payment history safely", () => {
  const plan = structuredClone(makePlan("legacy-browser-plan"));
  plan.schemaVersion = 1;
  plan.budget.items[0] = {
    ...plan.budget.items[0],
    amountMinor: 50_000,
    evidence: "committed",
    paidMinor: 25_000,
  };
  delete plan.budget.items[0].payments;
  delete plan.sessionAttendance;
  delete plan.draftBrief.sessions;
  delete plan.planBrief.sessions;
  plan.tasks.forEach((task) => delete task.sessionId);
  plan.budget.items.forEach((item) => delete item.sessionId);
  const legacyWorkspace = {
    format: "mehfiloom-workspace",
    schemaVersion: 1,
    activePlanId: plan.id,
    plans: [plan],
  };
  const values = new Map([[OLDEST_WORKSPACE_STORAGE_KEY, JSON.stringify(legacyWorkspace)]]);
  const loaded = loadWorkspaceFromStorage({ getItem(key) { return values.get(key) ?? null; } });

  assert.equal(loaded.schemaVersion, WORKSPACE_VERSION);
  assert.deepEqual(loaded.plans[0].planBrief.sessions, []);
  assert.deepEqual(loaded.plans[0].sessionAttendance, []);
  assert.ok(loaded.plans[0].tasks.every((task) => task.sessionId === null));
  assert.deepEqual(loaded.plans[0].budget.items[0].payments, [{
    id: "legacy-payment-1",
    amountMinor: 25_000,
    paidAt: null,
    note: "Existing total; payment date not recorded.",
  }]);
});

test("legacy v2 storage key and plan records migrate without losing payment totals", () => {
  const plan = structuredClone(makePlan("legacy-v2-plan"));
  plan.schemaVersion = 2;
  plan.budget.items[0] = {
    ...plan.budget.items[0],
    amountMinor: 60_000,
    evidence: "committed",
    paidMinor: 12_500,
  };
  delete plan.budget.items[0].payments;
  const legacyWorkspace = {
    format: "mehfiloom-workspace",
    schemaVersion: 2,
    activePlanId: plan.id,
    plans: [plan],
  };
  const values = new Map([[SECOND_OLDER_WORKSPACE_STORAGE_KEY, JSON.stringify(legacyWorkspace)]]);
  const loaded = loadWorkspaceFromStorage({ getItem(key) { return values.get(key) ?? null; } });

  assert.equal(loaded.schemaVersion, WORKSPACE_VERSION);
  assert.equal(loaded.plans[0].budget.items[0].paidMinor, 12_500);
  assert.deepEqual(loaded.plans[0].budget.items[0].payments, [{
    id: "legacy-payment-1",
    amountMinor: 12_500,
    paidAt: null,
    note: "Existing total; payment date not recorded.",
  }]);
});

test("legacy v3 storage migrates fee metadata to sourced amount defaults", () => {
  const plan = structuredClone(makePlan("legacy-v3-plan"));
  plan.schemaVersion = 3;
  plan.budget.items.forEach((item) => {
    delete item.taxesIncluded;
    delete item.chargesReviewed;
    delete item.adjustments;
  });
  const legacyWorkspace = {
    format: "mehfiloom-workspace",
    schemaVersion: 3,
    activePlanId: plan.id,
    plans: [plan],
  };
  const values = new Map([[OLDER_WORKSPACE_STORAGE_KEY, JSON.stringify(legacyWorkspace)]]);
  const loaded = loadWorkspaceFromStorage({ getItem(key) { return values.get(key) ?? null; } });

  assert.equal(loaded.schemaVersion, WORKSPACE_VERSION);
  assert.ok(loaded.plans[0].budget.items.every((item) => item.taxesIncluded === null && item.chargesReviewed === false && item.adjustments.length === 0));
});

test("legacy v4 workspace migrates to explicit timezone and relative-date defaults", () => {
  const plan = structuredClone(makePlan("legacy-v4-plan"));
  plan.schemaVersion = 4;
  for (const brief of [plan.draftBrief, plan.planBrief]) {
    delete brief.timeZone;
    delete brief.eventTime;
    delete brief.eventTimeOccurrence;
    brief.sessions = [{ id: "legacy-function", name: "Welcome function", date: "2027-02-13", guestCount: 90 }];
    brief.sessions.forEach((session) => {
      delete session.startTime;
      delete session.startTimeOccurrence;
    });
  }
  plan.sessionAttendance = [{ sessionId: "legacy-function", confirmedGuests: null }];
  plan.tasks.forEach((task) => delete task.relativeOffsetDays);
  const legacyWorkspace = { format: "mehfiloom-workspace", schemaVersion: 4, activePlanId: plan.id, plans: [plan] };
  const values = new Map([[LEGACY_WORKSPACE_STORAGE_KEY, JSON.stringify(legacyWorkspace)]]);
  const loaded = loadWorkspaceFromStorage({ getItem(key) { return values.get(key) ?? null; } });

  assert.equal(loaded.schemaVersion, WORKSPACE_VERSION);
  assert.equal(loaded.plans[0].planBrief.timeZone, null, "legacy plans do not guess a host timezone");
  assert.equal(loaded.plans[0].planBrief.eventTime, "");
  assert.equal(loaded.plans[0].planBrief.sessions[0].startTime, "");
  assert.equal(loaded.plans[0].planBrief.sessions[0].startTimeOccurrence, null);
  assert.ok(loaded.plans[0].tasks.every((task) => task.relativeOffsetDays === null));
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
  assert.ok(duplicate.budget.items.every((item) => item.payments.every((payment) => payment.id.startsWith(`${duplicate.id.slice(0, 64)}:cost:`))));
});

test("a saved plan rejects a budget currency that differs from its event currency", () => {
  const plan = makePlan();
  const mismatched = { ...plan, budget: { ...plan.budget, currency: "USD" } };

  assert.equal(savedPlanSchema.safeParse(mismatched).success, false);
  assert.throws(() => serializePlanDocument(mismatched));
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

test("version-one plans gain empty session fields without losing existing task or cost data", () => {
  const document = JSON.parse(serializePlanDocument(makePlan()));
  document.schemaVersion = 1;
  document.plan.schemaVersion = 1;
  delete document.plan.draftBrief.sessions;
  delete document.plan.planBrief.sessions;
  delete document.plan.sessionAttendance;
  document.plan.tasks.forEach((task) => delete task.sessionId);
  document.plan.budget.items.forEach((item) => delete item.sessionId);

  const upgraded = parsePlanDocument(JSON.stringify(document));
  assert.deepEqual(upgraded.planBrief.sessions, []);
  assert.deepEqual(upgraded.sessionAttendance, []);
  assert.ok(upgraded.tasks.every((task) => task.sessionId === null));
  assert.ok(upgraded.budget.items.every((item) => item.sessionId === null));
});

test("session-scoped per-guest forecasts use only that session; fixed and shared costs remain singular", () => {
  const sessions = [
    { id: "session-welcome", name: "Welcome gathering", date: "2027-02-13", guestCount: 80 },
    { id: "session-main", name: "Main celebration", date: "2027-02-14", guestCount: 120 },
  ];
  const brief = { ...EXAMPLE_BRIEF, guestCount: 150, sessions };
  const seed = createSavedPlan(brief, brief, EXAMPLE_PROPOSAL, "session-scope-plan", CREATED_AT);
  const baseCost = seed.budget.items[0];
  const costs = [
    { ...baseCost, id: "welcome-food", vendorId: null, sessionId: sessions[0].id, label: "Welcome meal", category: "food", amountMinor: 100, pricingModel: "per_guest", evidence: "estimate" },
    { ...baseCost, id: "main-food", vendorId: null, sessionId: sessions[1].id, label: "Main meal", category: "food", amountMinor: 100, pricingModel: "per_guest", evidence: "estimate" },
    { ...baseCost, id: "shared-drinks", vendorId: null, sessionId: null, label: "Shared drinks", category: "other", amountMinor: 50, pricingModel: "per_guest", evidence: "estimate" },
    { ...baseCost, id: "venue-hire", vendorId: null, sessionId: sessions[0].id, label: "Welcome venue", category: "venue", amountMinor: 5000, pricingModel: "fixed", evidence: "estimate" },
  ];
  const plan = savedPlanSchema.parse({
    ...seed,
    budget: { ...seed.budget, items: costs },
    sessionAttendance: sessions.map((session) => ({ sessionId: session.id, confirmedGuests: null })),
  });
  const welcome = plan.budget.items.find((item) => item.id === "welcome-food");
  const main = plan.budget.items.find((item) => item.id === "main-food");
  const shared = plan.budget.items.find((item) => item.id === "shared-drinks");
  const fixed = plan.budget.items.find((item) => item.id === "venue-hire");

  assert.equal(expectedGuestsForCostItem(plan, welcome), 80);
  assert.equal(forecastCostItem(welcome, expectedGuestsForCostItem(plan, welcome)).lowerMinor, 8000);
  assert.equal(forecastCostItem(main, expectedGuestsForCostItem(plan, main)).lowerMinor, 12000);
  assert.equal(forecastCostItem(shared, expectedGuestsForCostItem(plan, shared)).lowerMinor, 7500);
  assert.equal(forecastCostItem(fixed, expectedGuestsForCostItem(plan, fixed)).lowerMinor, 5000);
  assert.equal(calculateBudgetHealth(plan).knownCostsMinor, 32500);
});

test("sourced adjustments use exact minor-unit ranges and billed guest counts", () => {
  assert.equal(parseBudgetMinor("0.00", "USD", true), 0);
  assert.equal(parseBudgetMinor("0", "JPY", true), 0);
  assert.equal(parseBudgetMinor("0.01", "USD", true), 1);
  assert.throws(() => parseBudgetMinor("0.00", "USD"), /positive budget/);
  assert.throws(() => parseBudgetMinor("-1.00", "USD", true), /amount with up to/);
  assert.throws(() => parseBudgetMinor("999999999999.99", "USD", true), /supported planning range/);

  const seed = makePlan("adjusted-cost-plan");
  const cost = {
    ...seed.budget.items[0],
    amountMinor: 10_000,
    amountMaxMinor: 12_000,
    evidence: "quote",
    mandatory: false,
    feesIncluded: false,
    taxesIncluded: false,
    sourceNote: "Hall quote Q-17",
    adjustments: [
      { id: "discount-1", kind: "discount", label: "Early booking", pricingModel: "fixed", amountMinor: 500, amountMaxMinor: 700, sourceNote: "Hall quote Q-17" },
      { id: "fee-1", kind: "fee", label: "Delivery", pricingModel: "per_guest", amountMinor: 100, amountMaxMinor: 200, sourceNote: "Hall quote Q-17" },
      { id: "tax-1", kind: "tax", label: "Printed tax amount", pricingModel: "fixed", amountMinor: 900, amountMaxMinor: null, sourceNote: "Hall quote Q-17" },
    ],
  };
  assert.equal(costAdjustmentSchema.safeParse({
    id: "zero-adjustment", kind: "fee", label: "No delivery", pricingModel: "fixed", amountMinor: 0, amountMaxMinor: null, sourceNote: "Written quote says none",
  }).success, true);
  assert.equal(costAdjustmentSchema.safeParse({ ...cost.adjustments[0], amountMaxMinor: 400 }).success, false);
  assert.equal(costAdjustmentSchema.safeParse({ ...cost.adjustments[0], sourceNote: " " }).success, false);
  assert.equal(savedPlanSchema.safeParse({ ...seed, budget: { ...seed.budget, items: [{ ...cost, chargesReviewed: true, sourceNote: "No quote or local price has been supplied." }] } }).success, false);

  const plan = savedPlanSchema.parse({ ...seed, budget: { ...seed.budget, items: [cost] } });
  const forecast = forecastCostItem(plan.budget.items[0], 10);
  assert.equal(forecast.baseLowerMinor, 10_000);
  assert.equal(forecast.baseUpperMinor, 12_000);
  assert.equal(forecast.discountLowerMinor, 500);
  assert.equal(forecast.discountUpperMinor, 700);
  assert.equal(forecast.feeLowerMinor, 1_000);
  assert.equal(forecast.feeUpperMinor, 2_000);
  assert.equal(forecast.taxLowerMinor, 900);
  assert.equal(forecast.lowerMinor, 11_200);
  assert.equal(forecast.upperMinor, 14_400);

  const fixedBaseWithPerGuestFee = { ...plan.budget.items[0], adjustments: [cost.adjustments[1]] };
  assert.equal(forecastCostItem(fixedBaseWithPerGuestFee, 10).feeLowerMinor, 1_000);
});

test("sourced adjustments reject duplicate, unsupported, and over-commitment totals", () => {
  const seed = makePlan("invalid-adjustment-plan");
  const base = seed.budget.items[0];
  const fee = { id: "fee-line", kind: "fee", label: "Delivery fee", pricingModel: "fixed", amountMinor: 100, amountMaxMinor: null, sourceNote: "Vendor quote V-2" };
  const tax = { id: "tax-line", kind: "tax", label: "Tax amount", pricingModel: "fixed", amountMinor: 200, amountMaxMinor: null, sourceNote: "Vendor quote V-2" };
  const discount = { id: "discount-line", kind: "discount", label: "Booking credit", pricingModel: "fixed", amountMinor: 500, amountMaxMinor: null, sourceNote: "Vendor quote V-2" };
  const validCost = {
    ...base,
    amountMinor: 10_000,
    evidence: "committed",
    feesIncluded: false,
    taxesIncluded: false,
    chargesReviewed: true,
    sourceNote: "Vendor quote V-2",
    adjustments: [discount, fee, tax],
  };
  const accepted = savedPlanSchema.parse({ ...seed, budget: { ...seed.budget, reviewComplete: true, items: [validCost] } });
  assert.equal(calculateBudgetHealth(accepted).knownCostsMinor, 9_800);
  assert.equal(calculateBudgetHealth(accepted).unresolvedMandatoryChargeCount, 0);

  assert.equal(savedPlanSchema.safeParse({
    ...seed,
    budget: { ...seed.budget, items: [{ ...validCost, adjustments: [discount, { ...fee, id: discount.id }, tax] }] },
  }).success, false, "adjustment IDs must be unique within a cost");
  const overpaidCost = {
    ...validCost,
    paidMinor: 9_801,
    payments: [{ id: "payment-1", amountMinor: 9_801, paidAt: null, note: "Final" }],
  };
  assert.equal(savedPlanSchema.safeParse({ ...seed, budget: { ...seed.budget, items: [overpaidCost] } }).success, false);
  assert.equal(savedPlanSchema.safeParse({ ...seed, budget: { ...seed.budget, items: [{ ...validCost, feesIncluded: true }] } }).success, false);
  assert.equal(savedPlanSchema.safeParse({ ...seed, budget: { ...seed.budget, items: [{ ...validCost, adjustments: [{ ...discount, amountMinor: 10_001 }] }] } }).success, false);
  assert.equal(savedPlanSchema.safeParse({ ...seed, budget: { ...seed.budget, items: [{ ...validCost, adjustments: [discount, tax] }] } }).success, false, "a reviewed separate fee needs a sourced amount");

  const overflowBrief = { ...EXAMPLE_BRIEF, guestCount: 10_000 };
  const overflowSeed = createSavedPlan(overflowBrief, overflowBrief, EXAMPLE_PROPOSAL, "overflow-adjustment-plan", CREATED_AT);
  const overflowCost = {
    ...overflowSeed.budget.items[0],
    amountMinor: 1_000,
    evidence: "estimate",
    adjustments: [{ ...fee, pricingModel: "per_guest", amountMinor: 1_000_000_000_000 }],
  };
  assert.equal(savedPlanSchema.safeParse({ ...overflowSeed, budget: { ...overflowSeed.budget, items: [overflowCost] } }).success, false);
});

test("import re-identification keeps session links aligned across briefs, tasks, costs, and attendance", () => {
  const sessions = [{ id: "session-main", name: "Main celebration", date: "2027-02-14", guestCount: 90 }];
  const brief = { ...EXAMPLE_BRIEF, sessions };
  const seed = createSavedPlan(brief, brief, EXAMPLE_PROPOSAL, "session-import-source", CREATED_AT);
  const linked = savedPlanSchema.parse({
    ...seed,
    tasks: seed.tasks.map((task, index) => index === 0 ? { ...task, sessionId: sessions[0].id } : task),
    budget: { ...seed.budget, items: seed.budget.items.map((item, index) => index === 0 ? { ...item, sessionId: sessions[0].id } : item) },
    sessionAttendance: [{ sessionId: sessions[0].id, confirmedGuests: 72 }],
  });
  const imported = reidentifyPlan(linked, "session-import-copy", "2026-10-21T12:00:00.000Z");
  const newSessionId = imported.planBrief.sessions[0].id;

  assert.notEqual(newSessionId, sessions[0].id);
  assert.equal(imported.draftBrief.sessions[0].id, newSessionId);
  assert.equal(imported.tasks[0].sessionId, newSessionId);
  assert.equal(imported.budget.items[0].sessionId, newSessionId);
  assert.deepEqual(imported.sessionAttendance, [{ sessionId: newSessionId, confirmedGuests: 72 }]);
});

test("import rejects malformed, oversized, unsupported, and broken-reference documents", () => {
  const document = JSON.parse(serializePlanDocument(makePlan()));

  assert.throws(() => parsePlanDocument("{"), /valid JSON/i);
  assert.throws(() => parsePlanDocument(" ".repeat(500_001)), /too large/i);
  assert.throws(() => parsePlanDocument(JSON.stringify({ ...document, schemaVersion: 99 })), /schemaVersion/i);

  const wrongCurrency = structuredClone(document);
  wrongCurrency.plan.budget.currency = "USD";
  assert.throws(() => parsePlanDocument(JSON.stringify(wrongCurrency)));

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
    payments: [{ id: "deposit-1", amountMinor: 7_000, paidAt: "2026-10-20", note: "Venue deposit" }],
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
  const committed = {
    ...estimate,
    evidence: "committed",
    paidMinor: 5_000,
    payments: [{ id: "payment-1", amountMinor: 5_000, paidAt: "2026-10-20", note: "Deposit" }],
  };
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

test("later payments update paid and outstanding while the commitment forecast stays fixed", () => {
  const plan = makePlan();
  const commitmentBase = {
    ...plan.budget.items[0],
    amountMinor: 50_000,
    amountMaxMinor: null,
    evidence: "committed",
    paidMinor: 0,
    payments: [],
    feesIncluded: true,
  };
  const commitment = addCostPayment(commitmentBase, { id: "payment-1", amountMinor: 10_000, paidAt: "2026-10-20", note: "Deposit" }, 50_000);
  const firstPayment = {
    ...plan,
    budget: { ...plan.budget, reviewComplete: true, items: [commitment, ...plan.budget.items.slice(1)] },
  };
  const laterPayment = {
    ...firstPayment,
    budget: {
      ...firstPayment.budget,
      items: [addCostPayment(commitment, { id: "payment-2", amountMinor: 22_000, paidAt: "2026-10-21", note: "Second installment" }, 50_000), ...firstPayment.budget.items.slice(1)],
    },
  };
  const firstHealth = calculateBudgetHealth(firstPayment);
  const laterHealth = calculateBudgetHealth(laterPayment);

  assert.equal(firstHealth.knownCostsMinor, 50_000);
  assert.equal(laterHealth.knownCostsMinor, firstHealth.knownCostsMinor);
  assert.equal(firstHealth.paidMinor, 10_000);
  assert.equal(laterHealth.paidMinor, 32_000);
  assert.equal(firstHealth.outstandingCommittedMinor, 40_000);
  assert.equal(laterHealth.outstandingCommittedMinor, 18_000);
  assert.deepEqual(laterPayment.budget.items[0].payments.map(({ amountMinor }) => amountMinor), [10_000, 22_000]);

  const roundTrip = parseWorkspaceJson(serializeWorkspace({
    format: "mehfiloom-workspace",
    schemaVersion: WORKSPACE_VERSION,
    activePlanId: laterPayment.id,
    plans: [laterPayment],
  }));
  assert.deepEqual(roundTrip.plans[0].budget.items[0].payments, laterPayment.budget.items[0].payments);
  const afterRemoval = removeCostPayment(laterPayment.budget.items[0], "payment-1");
  assert.equal(afterRemoval.paidMinor, 22_000);
  assert.equal(afterRemoval.payments.length, 1);
  assert.throws(() => addCostPayment(commitment, { id: "payment-too-large", amountMinor: 40_001, paidAt: null, note: "Overpayment" }, 50_000), /remaining commitment balance/);
  assert.throws(() => removeCostPayment(commitment, "missing-payment"), /not found/);
});

test("payment history must match the paid total and only belong to a commitment", () => {
  const plan = makePlan();
  const base = plan.budget.items[0];
  const payment = { id: "payment-one", amountMinor: 2_500, paidAt: "2026-10-20", note: "Deposit" };
  const mismatch = {
    ...plan,
    budget: { ...plan.budget, items: [{ ...base, amountMinor: 10_000, evidence: "committed", paidMinor: 3_000, payments: [payment] }, ...plan.budget.items.slice(1)] },
  };
  assert.throws(() => savedPlanSchema.parse(mismatch), /Recorded payments must add up to the paid total/);

  const uncommitted = {
    ...plan,
    budget: { ...plan.budget, items: [{ ...base, payments: [payment] }, ...plan.budget.items.slice(1)] },
  };
  assert.throws(() => savedPlanSchema.parse(uncommitted), /Payments can only be recorded against a commitment/);
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
    feesIncluded: true,
    taxesIncluded: true,
    chargesReviewed: true,
    sourceNote: "Synthetic vendor quote Q-4.",
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

test("unresolved mandatory fee amounts prevent a green budget status", () => {
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

  assert.equal(calculateBudgetHealth(withUnknownFees).unresolvedMandatoryChargeCount, 1);
  assert.equal(calculateBudgetHealth(withUnknownFees).state, "unknown");
  const feesExcluded = calculateBudgetHealth({
    ...withUnknownFees,
    budget: { ...withUnknownFees.budget, items: [{ ...mandatoryCost, feesIncluded: false }, ...withUnknownFees.budget.items.slice(1)] },
  });
  assert.equal(feesExcluded.unresolvedMandatoryChargeCount, 1);
  assert.equal(feesExcluded.state, "unknown", "an excluded fee without a recorded amount is not a complete forecast");
  assert.equal(calculateBudgetHealth({
    ...withUnknownFees,
    budget: { ...withUnknownFees.budget, items: [{ ...mandatoryCost, feesIncluded: true, taxesIncluded: true, chargesReviewed: true, sourceNote: "Vendor quote V-9 confirmed both amounts included." }, ...withUnknownFees.budget.items.slice(1)] },
  }).state, "within_cap");
});

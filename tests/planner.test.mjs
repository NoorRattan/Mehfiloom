import assert from "node:assert/strict";
import test from "node:test";
import { createProposalGenerator } from "../lib/gemini.ts";
import {
  EXAMPLE_BRIEF,
  EXAMPLE_PROPOSAL,
  buildPlanResult,
  eventBriefSchema,
  formatMoney,
  parseBudgetMinor,
  proposalSchema,
} from "../lib/planner.ts";

test("budget input converts exactly using the selected currency precision", () => {
  assert.equal(parseBudgetMinor("250000.75", "INR"), 25_000_075);
  assert.equal(parseBudgetMinor("1200", "JPY"), 1_200);
  assert.equal(parseBudgetMinor("1.234", "KWD"), 1_234);
  assert.equal(formatMoney(25_000_075, "INR"), "₹250,000.75");
});

test("budget input rejects zero, negatives, excess decimals, and overflow", () => {
  for (const value of ["0", "-1", "1.234", "10000000000.01", "1,000"]) {
    assert.throws(() => parseBudgetMinor(value, "INR"), undefined, `Expected ${value} to be rejected`);
  }
  assert.throws(() => parseBudgetMinor("1.2", "JPY"));
});

test("budget allocations reconcile exactly to the host cap in minor units", () => {
  const result = buildPlanResult(EXAMPLE_PROPOSAL, "INR", 101);
  const sum = result.lines.reduce((total, line) => total + line.amountMinor, 0);

  assert.equal(result.totalMinor, 101);
  assert.equal(result.allocatedMinor, 101);
  assert.equal(sum, result.totalMinor);
  assert.ok(result.lines.every((line) => Number.isInteger(line.amountMinor)));
});

test("budget allocator rejects duplicate categories instead of hiding the duplicate", () => {
  const duplicateCategory = {
    ...EXAMPLE_PROPOSAL,
    budgetAllocations: [
      ...EXAMPLE_PROPOSAL.budgetAllocations,
      { ...EXAMPLE_PROPOSAL.budgetAllocations[0] },
    ],
  };

  assert.throws(() => buildPlanResult(duplicateCategory, "INR", 25_000_000), /repeated a budget category/);
});

test("budget allocator requires a contingency and a supported positive cap", () => {
  const withoutReserve = {
    ...EXAMPLE_PROPOSAL,
    budgetAllocations: EXAMPLE_PROPOSAL.budgetAllocations.filter((line) => line.category !== "contingency"),
  };

  assert.throws(() => buildPlanResult(withoutReserve, "INR", 25_000_000), /omitted a contingency/);
  for (const amount of [0, -1, 1.5, 1_000_000_000_001]) {
    assert.throws(() => buildPlanResult(EXAMPLE_PROPOSAL, "INR", amount), /positive budget/);
  }
});

test("brief validation accepts an unset date and rejects impossible calendar dates", () => {
  assert.equal(eventBriefSchema.safeParse({ ...EXAMPLE_BRIEF, eventDate: "" }).success, true);
  assert.equal(eventBriefSchema.safeParse({ ...EXAMPLE_BRIEF, eventDate: "2027-02-29" }).success, false);
  assert.equal(eventBriefSchema.safeParse({ ...EXAMPLE_BRIEF, eventDate: "2028-02-29" }).success, true);
});

test("the sample proposal conforms to the same runtime contract used for model output", () => {
  assert.deepEqual(proposalSchema.parse(EXAMPLE_PROPOSAL), EXAMPLE_PROPOSAL);
});

test("Gemini adapter sends a bounded structured request and validates returned JSON", async () => {
  let capturedRequest;
  let capturedOptions;
  const client = {
    interactions: {
      async create(request, options) {
        capturedRequest = request;
        capturedOptions = options;
        return { output_text: JSON.stringify(EXAMPLE_PROPOSAL) };
      },
    },
  };
  const brief = { ...EXAMPLE_BRIEF, eventName: "A synthetic test gathering" };
  const generate = createProposalGenerator(client);

  assert.deepEqual(await generate(brief), EXAMPLE_PROPOSAL);
  assert.equal(capturedRequest.model, "gemini-3.8-flash");
  assert.match(capturedRequest.system_instruction, /untrusted user-provided data/);
  assert.match(capturedRequest.input, /A synthetic test gathering/);
  assert.equal(capturedRequest.generation_config.max_output_tokens, 1800);
  assert.equal(capturedRequest.response_format.type, "text");
  assert.equal(capturedRequest.response_format.mime_type, "application/json");
  assert.ok(capturedRequest.response_format.schema.properties);
  assert.deepEqual(capturedOptions, {
    timeout_ms: 25_000,
    retries: { strategy: "none" },
  });
});

test("Gemini adapter rejects malformed and schema-invalid provider output", async () => {
  const clientReturning = (output_text) => ({
    interactions: { async create() { return { output_text }; } },
  });

  await assert.rejects(
    createProposalGenerator(clientReturning("not JSON"))(EXAMPLE_BRIEF),
    SyntaxError,
  );

  const invalidProposal = { ...EXAMPLE_PROPOSAL, timeline: [] };
  await assert.rejects(
    createProposalGenerator(clientReturning(JSON.stringify(invalidProposal)))(EXAMPLE_BRIEF),
    /Too small/i,
  );
});

test("Gemini adapter validates the brief before calling the provider", async () => {
  let called = false;
  const client = { interactions: { async create() { called = true; return { output_text: "{}" }; } } };

  await assert.rejects(
    createProposalGenerator(client)({ ...EXAMPLE_BRIEF, guestCount: 0 }),
  );
  assert.equal(called, false);
});

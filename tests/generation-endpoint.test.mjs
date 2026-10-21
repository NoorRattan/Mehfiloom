import assert from "node:assert/strict";
import test from "node:test";
import { createGenerationEndpoint, createInMemoryGenerationLimiter } from "../lib/generation-endpoint.ts";
import { EXAMPLE_BRIEF, EXAMPLE_PROPOSAL } from "../lib/planner.ts";

const endpointUrl = "http://localhost/api/generate";

function request(body, headers = {}) {
  return new Request(endpointUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function makeEndpoint(overrides = {}) {
  let providerCalls = 0;
  const handle = createGenerationEndpoint({
    hasProviderKey: () => true,
    generate: async () => {
      providerCalls += 1;
      return EXAMPLE_PROPOSAL;
    },
    allowRequest: () => true,
    ...overrides,
  });
  return { handle, providerCalls: () => providerCalls };
}

test("generation endpoint returns a no-store plan without exposing implementation details", async () => {
  const { handle, providerCalls } = makeEndpoint();
  const response = await handle(request(EXAMPLE_BRIEF));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(payload.result.totalMinor, 25_000_000);
  assert.equal(payload.result.allocatedMinor, 25_000_000);
  assert.equal(providerCalls(), 1);
});

test("invalid JSON, absent body, and invalid briefs fail before a provider call", async () => {
  const { handle, providerCalls } = makeEndpoint();
  const malformed = await handle(request("{"));
  const empty = await handle(new Request(endpointUrl, { method: "POST" }));
  const invalid = await handle(request({ ...EXAMPLE_BRIEF, eventName: "x" }));

  assert.equal(malformed.status, 400);
  assert.equal(empty.status, 400);
  assert.equal(invalid.status, 400);
  for (const response of [malformed, empty, invalid]) {
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal(providerCalls(), 0);
});

test("non-JSON request bodies are rejected before rate limiting or provider calls", async () => {
  let slotChecks = 0;
  const { handle, providerCalls } = makeEndpoint({
    allowRequest: () => { slotChecks += 1; return true; },
  });
  const response = await handle(request(JSON.stringify(EXAMPLE_BRIEF), { "Content-Type": "text/plain" }));
  const payload = await response.json();

  assert.equal(response.status, 415);
  assert.equal(payload.error.message, "Send the event brief as JSON.");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(slotChecks, 0);
  assert.equal(providerCalls(), 0);
});

test("declared and streamed oversize request bodies are rejected", async () => {
  const { handle, providerCalls } = makeEndpoint();
  const declared = await handle(request("{}", { "Content-Length": String(16 * 1024 + 1) }));
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(16 * 1024 + 1));
      controller.close();
    },
  });
  const streamedRequest = new Request(endpointUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: stream,
    duplex: "half",
  });
  const streamed = await handle(streamedRequest);

  assert.equal(declared.status, 413);
  assert.equal(streamed.status, 413);
  assert.equal(providerCalls(), 0);
});

test("unsupported input is not reflected in an error response", async () => {
  const { handle, providerCalls } = makeEndpoint();
  const hostileValue = "<script>send private data</script>";
  const response = await handle(request({ ...EXAMPLE_BRIEF, surprise: hostileValue }));
  const responseText = await response.text();

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(responseText.includes(hostileValue), false);
  assert.equal(providerCalls(), 0);
});

test("missing provider configuration does not consume an AI request slot", async () => {
  let slotChecks = 0;
  const { handle, providerCalls } = makeEndpoint({
    hasProviderKey: () => false,
    allowRequest: () => { slotChecks += 1; return true; },
  });
  const response = await handle(request(EXAMPLE_BRIEF));
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.error.code, "PROVIDER_NOT_CONFIGURED");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(slotChecks, 0);
  assert.equal(providerCalls(), 0);
});

test("per-client request limit stops at four calls and advertises its reset window", async () => {
  const limiter = createInMemoryGenerationLimiter(() => 1_000);
  const { handle, providerCalls } = makeEndpoint({ allowRequest: limiter });
  const statuses = [];
  let limitedResponse;
  for (let i = 0; i < 5; i += 1) {
    const response = await handle(request(EXAMPLE_BRIEF, { "x-forwarded-for": "198.51.100.4, 10.0.0.2" }));
    statuses.push(response.status);
    if (i === 4) limitedResponse = response;
  }

  assert.deepEqual(statuses, [200, 200, 200, 200, 429]);
  assert.equal(limitedResponse.headers.get("retry-after"), "1200");
  assert.equal(limitedResponse.headers.get("cache-control"), "no-store");
  assert.equal(providerCalls(), 4);
});

test("in-memory request limit opens a fresh window after expiry", () => {
  let now = 1_000;
  const limiter = createInMemoryGenerationLimiter(() => now);
  const clientRequest = request(EXAMPLE_BRIEF, { "x-real-ip": "198.51.100.5" });

  assert.deepEqual(Array.from({ length: 5 }, () => limiter(clientRequest)), [true, true, true, true, false]);
  now += 20 * 60 * 1000;
  assert.equal(limiter(clientRequest), true);
});

test("in-memory request limiter caps tracked clients and evicts expired entries", () => {
  let now = 1_000;
  const limiter = createInMemoryGenerationLimiter(() => now);
  const client = (index) => new Request(endpointUrl, { method: "POST", headers: { "x-real-ip": `synthetic-client-${index}` } });

  for (let index = 0; index < 2000; index += 1) {
    assert.equal(limiter(client(index)), true);
  }
  assert.equal(limiter(client(2000)), false);
  now += 20 * 60 * 1000;
  assert.equal(limiter(client(2000)), true);
});

test("provider failures return a generic no-store error and preserve the submitted brief", async () => {
  const secretStack = "private-provider-detail api-key=secret-test-value";
  const { handle } = makeEndpoint({ generate: async () => { throw new Error(secretStack); } });
  const response = await handle(request(EXAMPLE_BRIEF));
  const responseText = await response.text();

  assert.equal(response.status, 502);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(responseText.includes(secretStack), false);
  assert.match(responseText, /Your brief is unchanged/);
});

test("model output that violates a deterministic budget invariant fails closed", async () => {
  const unsafeProposal = {
    ...EXAMPLE_PROPOSAL,
    budgetAllocations: EXAMPLE_PROPOSAL.budgetAllocations.filter((line) => line.category !== "contingency"),
  };
  const { handle } = makeEndpoint({ generate: async () => unsafeProposal });
  const response = await handle(request(EXAMPLE_BRIEF));
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(payload.error.message, /Your brief is unchanged/);
  assert.equal(payload.result, undefined);
});

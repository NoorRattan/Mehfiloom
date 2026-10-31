import assert from "node:assert/strict";
import test from "node:test";
import {
  createGenerationEndpoint,
  createInMemoryGenerationLimiter,
} from "../lib/generation-endpoint.ts";
import {
  EXAMPLE_BRIEF,
  EXAMPLE_PROPOSAL,
  generationRequestSchema,
} from "../lib/planner.ts";

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

test("ordinary generation forwards a validated brief in the provider-supported shape", async () => {
  let received;
  const { handle } = makeEndpoint({
    generate: async (input) => {
      received = input;
      generationRequestSchema.parse(input);
      return EXAMPLE_PROPOSAL;
    },
  });
  const response = await handle(request(EXAMPLE_BRIEF));

  assert.equal(response.status, 200);
  assert.deepEqual(received, EXAMPLE_BRIEF);
});

test("revision endpoint forwards accepted revision history intact to the generator", async () => {
  let received;
  const priorRevisionRequests = [
    "Keep dancing optional and provide a quieter participation choice.",
    "Avoid activities that require guests to stand for a long time.",
  ];
  const revisionRequest = "Keep the quiet option and update the welcome plan.";
  const { handle: validatingHandle } = makeEndpoint({
    generate: async (input) => {
      received = input;
      generationRequestSchema.parse(input);
      return EXAMPLE_PROPOSAL;
    },
  });
  const response = await validatingHandle(
    request({ brief: EXAMPLE_BRIEF, priorRevisionRequests, revisionRequest }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(received.priorRevisionRequests, priorRevisionRequests);
  assert.equal(received.revisionRequest, revisionRequest);
  assert.deepEqual(received.brief, EXAMPLE_BRIEF);
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
    allowRequest: () => {
      slotChecks += 1;
      return true;
    },
  });
  const response = await handle(
    request(JSON.stringify(EXAMPLE_BRIEF), { "Content-Type": "text/plain" }),
  );
  const payload = await response.json();

  assert.equal(response.status, 415);
  assert.equal(payload.error.message, "Send the event brief as JSON.");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(slotChecks, 0);
  assert.equal(providerCalls(), 0);
});

test("declared and streamed oversize request bodies are rejected", async () => {
  const { handle, providerCalls } = makeEndpoint();
  const declared = await handle(
    request("{}", { "Content-Length": String(16 * 1024 + 1) }),
  );
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

test("stalled uploads time out and cancel the body without waiting on the source", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    cancel() {
      cancelled = true;
      return new Promise(() => {});
    },
  });
  const pending = new Request(endpointUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    duplex: "half",
  });
  const { handle, providerCalls } = makeEndpoint({ bodyTimeoutMs: 5 });
  const response = await handle(pending);
  assert.equal(response.status, 408);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
  assert.equal(providerCalls(), 0);
});

test("aborting a pending upload releases its reader and prevents provider calls", async () => {
  let cancelled = false;
  const controller = new AbortController();
  const body = new ReadableStream({
    cancel() {
      cancelled = true;
    },
  });
  const pending = new Request(endpointUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    duplex: "half",
    signal: controller.signal,
  });
  const { handle, providerCalls } = makeEndpoint();
  const responsePromise = handle(pending);
  controller.abort();
  const response = await responsePromise;
  assert.equal(response.status, 408);
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
  assert.equal(providerCalls(), 0);
});

test("malformed UTF-8 is rejected instead of silently changing the host's brief", async () => {
  const prefix = new TextEncoder().encode(
    JSON.stringify(EXAMPLE_BRIEF).replace("A spring wedding", "PLACEHOLDER"),
  );
  const marker = new TextEncoder().encode("PLACEHOLDER");
  const start = prefix.findIndex((_, index) =>
    marker.every((value, offset) => prefix[index + offset] === value),
  );
  const body = new Uint8Array([
    ...prefix.slice(0, start),
    0xc3,
    0x28,
    ...prefix.slice(start + marker.length),
  ]);
  const { handle, providerCalls } = makeEndpoint();
  const response = await handle(
    new Request(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
  );
  assert.equal(response.status, 400);
  assert.equal(providerCalls(), 0);
});

test("UTF-8 characters split across upload chunks remain intact", async () => {
  const brief = { ...EXAMPLE_BRIEF, eventName: "A gathering 🌻" };
  const bytes = new TextEncoder().encode(JSON.stringify(brief));
  const body = new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  });
  let received;
  const { handle } = makeEndpoint({
    generate: async (input) => {
      received = input;
      return EXAMPLE_PROPOSAL;
    },
  });
  const response = await handle(
    new Request(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      duplex: "half",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(received.eventName, brief.eventName);
});

test("request cancellation reaches an in-flight provider operation", async () => {
  const controller = new AbortController();
  let capturedSignal;
  let providerStarted;
  const started = new Promise((resolve) => {
    providerStarted = resolve;
  });
  const { handle } = makeEndpoint({
    generate: async (_input, options) => {
      capturedSignal = options.signal;
      providerStarted();
      await new Promise((resolve) =>
        capturedSignal.addEventListener("abort", resolve, { once: true }),
      );
      throw new DOMException("Cancelled", "AbortError");
    },
  });
  const pending = new Request(endpointUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(EXAMPLE_BRIEF),
    signal: controller.signal,
  });
  const responsePromise = handle(pending);
  await started;
  controller.abort();
  const response = await responsePromise;
  assert.equal(capturedSignal.aborted, true);
  assert.equal(response.status, 504);
});

test("unsupported currencies and unknown model session references never produce a plan", async () => {
  const { handle, providerCalls } = makeEndpoint();
  assert.equal(
    (await handle(request({ ...EXAMPLE_BRIEF, currency: "ZZZ" }))).status,
    400,
  );
  assert.equal(providerCalls(), 0);
  const proposal = structuredClone(EXAMPLE_PROPOSAL);
  proposal.timeline[0].sessionId = "invented-session";
  const { handle: invalidOutput } = makeEndpoint({
    generate: async () => proposal,
  });
  const response = await invalidOutput(request(EXAMPLE_BRIEF));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).result, undefined);
});

test("unsupported input is not reflected in an error response", async () => {
  const { handle, providerCalls } = makeEndpoint();
  const hostileValue = "<script>send private data</script>";
  const response = await handle(
    request({ ...EXAMPLE_BRIEF, surprise: hostileValue }),
  );
  const responseText = await response.text();

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(responseText.includes(hostileValue), false);
  assert.equal(providerCalls(), 0);
});

test("missing provider configuration still passes through ingress admission", async () => {
  let slotChecks = 0;
  const { handle, providerCalls } = makeEndpoint({
    hasProviderKey: () => false,
    allowRequest: () => {
      slotChecks += 1;
      return true;
    },
  });
  const response = await handle(request(EXAMPLE_BRIEF));
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.error.code, "PROVIDER_NOT_CONFIGURED");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(slotChecks, 1);
  assert.equal(providerCalls(), 0);
});

test("per-client request limit stops at four calls and advertises its reset window", async () => {
  const limiter = createInMemoryGenerationLimiter(() => 1_000);
  const { handle, providerCalls } = makeEndpoint({ allowRequest: limiter });
  const statuses = [];
  let limitedResponse;
  for (let i = 0; i < 5; i += 1) {
    const response = await handle(
      request(EXAMPLE_BRIEF, { "x-forwarded-for": "198.51.100.4, 10.0.0.2" }),
    );
    statuses.push(response.status);
    if (i === 4) limitedResponse = response;
  }

  assert.deepEqual(statuses, [200, 200, 200, 200, 429]);
  assert.equal(limitedResponse.headers.get("retry-after"), "1200");
  assert.equal(limitedResponse.headers.get("cache-control"), "no-store");
  assert.equal(providerCalls(), 4);
});

test("ingress rejection does not read the body or run time-zone validation", async (t) => {
  const { handle, providerCalls } = makeEndpoint({ allowRequest: () => false });
  const pending = request({
    ...EXAMPLE_BRIEF,
    eventDate: "2027-01-01",
    eventTime: "12:00",
    timeZone: "Europe/Paris",
  });
  const reader = t.mock.method(pending.body, "getReader", () => {
    throw new Error("Body must not be consumed after ingress rejection");
  });
  const formatter = t.mock.method(Intl, "DateTimeFormat", () => {
    throw new Error(
      "Expensive validation must not run after ingress rejection",
    );
  });
  const response = await handle(pending);
  assert.equal(response.status, 429);
  assert.equal(reader.mock.callCount(), 0);
  assert.equal(formatter.mock.callCount(), 0);
  assert.equal(providerCalls(), 0);
});

test("malformed attempts consume ingress allowance before expensive parsing", async () => {
  const { handle, providerCalls } = makeEndpoint({
    allowRequest: createInMemoryGenerationLimiter(() => 1000),
  });
  const statuses = [];
  for (let i = 0; i < 5; i += 1)
    statuses.push((await handle(request("{"))).status);
  assert.deepEqual(statuses, [400, 400, 400, 400, 429]);
  assert.equal(providerCalls(), 0);
});

test("in-memory request limit opens a fresh window after expiry", () => {
  let now = 1_000;
  const limiter = createInMemoryGenerationLimiter(() => now);
  const clientRequest = request(EXAMPLE_BRIEF, { "x-real-ip": "198.51.100.5" });

  assert.deepEqual(
    Array.from({ length: 5 }, () => limiter(clientRequest)),
    [true, true, true, true, false],
  );
  now += 20 * 60 * 1000;
  assert.equal(limiter(clientRequest), true);
});

test("in-memory request limiter caps tracked clients and evicts expired entries", () => {
  let now = 1_000;
  const limiter = createInMemoryGenerationLimiter(() => now);
  const client = (index) =>
    new Request(endpointUrl, {
      method: "POST",
      headers: { "x-real-ip": `synthetic-client-${index}` },
    });

  for (let index = 0; index < 2000; index += 1) {
    assert.equal(limiter(client(index)), true);
  }
  assert.equal(limiter(client(2000)), false);
  now += 20 * 60 * 1000;
  assert.equal(limiter(client(2000)), true);
});

test("provider failures return a generic no-store error and preserve the submitted brief", async () => {
  const secretStack = "private-provider-detail api-key=secret-test-value";
  const { handle } = makeEndpoint({
    generate: async () => {
      throw new Error(secretStack);
    },
  });
  const response = await handle(request(EXAMPLE_BRIEF));
  const responseText = await response.text();

  assert.equal(response.status, 502);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(responseText.includes(secretStack), false);
  assert.match(responseText, /Your brief is unchanged/);
});

test("provider rate limits return a generic retryable service error", async () => {
  const privateProviderMessage = "quota exceeded api-key=secret-test-value";
  const rateLimit = Object.assign(new Error(privateProviderMessage), {
    status: 429,
  });
  const { handle } = makeEndpoint({
    generate: async () => {
      throw rateLimit;
    },
  });
  const response = await handle(request(EXAMPLE_BRIEF));
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(payload.error.code, "PROVIDER_RATE_LIMITED");
  assert.equal(JSON.stringify(payload).includes(privateProviderMessage), false);
});

test("provider timeouts return a generic gateway timeout", async () => {
  const privateProviderMessage = "request timed out api-key=secret-test-value";
  const timeout = new Error(privateProviderMessage);
  timeout.name = "APIConnectionTimeoutError";
  const { handle } = makeEndpoint({
    generate: async () => {
      throw timeout;
    },
  });
  const response = await handle(request(EXAMPLE_BRIEF));
  const payload = await response.json();

  assert.equal(response.status, 504);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(payload.error.code, "PROVIDER_TIMEOUT");
  assert.equal(JSON.stringify(payload).includes(privateProviderMessage), false);
  assert.match(payload.error.message, /Your brief is unchanged/);
});

test("model output that violates a deterministic budget invariant fails closed", async () => {
  const unsafeProposal = {
    ...EXAMPLE_PROPOSAL,
    budgetAllocations: EXAMPLE_PROPOSAL.budgetAllocations.filter(
      (line) => line.category !== "contingency",
    ),
  };
  const { handle } = makeEndpoint({ generate: async () => unsafeProposal });
  const response = await handle(request(EXAMPLE_BRIEF));
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(payload.error.message, /Your brief is unchanged/);
  assert.equal(payload.result, undefined);
});

test("consumed and locked upload streams fail as unreadable requests without a provider call", async () => {
  const { handle, providerCalls } = makeEndpoint();
  const consumed = request(EXAMPLE_BRIEF);
  await consumed.text();
  const consumedResponse = await handle(consumed);
  assert.equal(consumedResponse.status, 400);
  assert.equal(
    (await consumedResponse.json()).error.message,
    "The event brief could not be read. Please try again.",
  );

  const locked = request(EXAMPLE_BRIEF);
  const reader = locked.body.getReader();
  const lockedResponse = await handle(locked);
  assert.equal(lockedResponse.status, 400);
  assert.equal(lockedResponse.headers.get("cache-control"), "no-store");
  reader.releaseLock();
  assert.equal(providerCalls(), 0);
});

test("a provider completion after cancellation cannot be returned as a successful plan", async () => {
  const controller = new AbortController();
  const { handle } = makeEndpoint({
    generate: async () => {
      controller.abort();
      return EXAMPLE_PROPOSAL;
    },
  });
  const pending = new Request(endpointUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(EXAMPLE_BRIEF),
    signal: controller.signal,
  });
  const response = await handle(pending);
  const payload = await response.json();
  assert.equal(response.status, 408);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(payload.result, undefined);
  assert.match(payload.error.message, /cancelled/);
});

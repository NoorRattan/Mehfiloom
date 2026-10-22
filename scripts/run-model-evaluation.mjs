import Groq from "groq-sdk";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProposalGenerator, toGroqStrictJsonSchema } from "../lib/groq.ts";
import { proposalJsonSchema } from "../lib/planner.ts";
import { fixtures, NEUTRAL_GUIDANCE } from "./model-evaluation-fixtures.mjs";

const MODEL = "openai/gpt-oss-120b";
const MAX_COMPLETION_TOKENS = 3000;
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_RETRIES = 0;
const REASONING_EFFORT = "low";
const MAX_CALLS = fixtures.length * 2;
const MIN_GAP_MS = 2_200;
const RUN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "Mehfiloom-project-files", "model-evaluation-runs");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value) {
  return JSON.stringify(value);
}

function applyPromptVariant(messages, variant) {
  if (variant === "current") return messages;
  const userIndex = messages.findIndex((message) => message.role === "user");
  if (userIndex < 0 || typeof messages[userIndex].content !== "string") {
    throw new Error("Could not locate the user prompt for baseline replacement.");
  }
  const content = messages[userIndex].content;
  const opening = "Event-type focus:\n";
  const ending = "\n\nEvent brief (JSON data):";
  const start = content.indexOf(opening);
  const end = content.indexOf(ending, start + opening.length);
  if (start < 0 || end < 0) throw new Error("Could not locate event-specific guidance block.");
  const replaced = content.slice(0, start + opening.length) + NEUTRAL_GUIDANCE + content.slice(end);
  const output = [...messages];
  output[userIndex] = { ...messages[userIndex], content: replaced };
  return output;
}

function parseEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) throw new Error("ENV_FILE_MISSING");
  const content = readFileSync(envPath, "utf8");
  const line = content.split(/\r?\n/).find((entry) => /^\s*(?:export\s+)?GROQ_API_KEY\s*=/.test(entry));
  if (!line) throw new Error("GROQ_KEY_NOT_CONFIGURED");
  let key = line.slice(line.indexOf("=") + 1).trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1);
  if (!/^gsk_[A-Za-z0-9_-]+$/.test(key)) throw new Error("GROQ_KEY_FORMAT_INVALID");
  return key;
}

function sanitize(value) {
  if (typeof value === "string") {
    return value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
      .replace(/(?:\+?\d[\d\s().-]{8,}\d)/g, "[redacted-phone]");
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sanitize(child)]));
  }
  return value;
}

function errorMetadata(error) {
  return {
    errorName: typeof error?.name === "string" ? error.name : "Error",
    errorStatus: Number.isInteger(error?.status) ? error.status : null,
    errorCode: typeof error?.code === "string" ? error.code : null,
  };
}

async function preflight() {
  const manifest = [];
  for (const entry of fixtures) {
    const promptHashes = {};
    for (const variant of ["current", "neutral"]) {
      let captured;
      const fakeClient = {
        chat: {
          completions: {
            async create(request) {
              captured = {
                ...request,
                messages: applyPromptVariant(request.messages, variant),
              };
              throw new Error("PREFLIGHT_CAPTURED");
            },
          },
        },
      };
      try {
        await createProposalGenerator(fakeClient, MODEL)(entry.brief);
      } catch {
        // The capture client intentionally throws before making any network request.
      }
      if (!captured) throw new Error("PREFLIGHT_DID_NOT_CAPTURE_PROMPT");
      const systemText = captured.messages.find((message) => message.role === "system")?.content ?? "";
      const userText = captured.messages.find((message) => message.role === "user")?.content ?? "";
      promptHashes[variant] = {
        systemPromptSha256: sha256(systemText),
        userPromptSha256: sha256(userText),
        fullMessagesSha256: sha256(canonical(captured.messages)),
        requestContractSha256: sha256(canonical({
          model: captured.model,
          max_completion_tokens: captured.max_completion_tokens,
          reasoning_effort: captured.reasoning_effort,
          response_format: captured.response_format,
        })),
      };
    }
    if (promptHashes.current.systemPromptSha256 !== promptHashes.neutral.systemPromptSha256) {
      throw new Error("SYSTEM_PROMPT_DIFFERS_BETWEEN_VARIANTS");
    }
    if (promptHashes.current.requestContractSha256 !== promptHashes.neutral.requestContractSha256) {
      throw new Error("REQUEST_CONTRACT_DIFFERS_BETWEEN_VARIANTS");
    }
    manifest.push({
      id: entry.id,
      split: entry.split,
      fixtureSha256: sha256(canonical(entry.brief)),
      promptHashes,
    });
  }
  return {
    status: "preflight",
    callsPerformed: 0,
    maxCalls: MAX_CALLS,
    model: MODEL,
    parameters: {
      maxCompletionTokens: MAX_COMPLETION_TOKENS,
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxRetries: MAX_RETRIES,
      reasoningEffort: REASONING_EFFORT,
      minimumRequestGapMs: MIN_GAP_MS,
      responseSchemaSha256: sha256(canonical(toGroqStrictJsonSchema(proposalJsonSchema))),
      pricingAssumptionUsdPerMillionTokens: { input: 0.15, output: 0.60 },
      pricingSource: "https://console.groq.com/docs/model/openai/gpt-oss-120b",
    },
    appRevision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    fixtures: manifest,
  };
}

function seededBit(seed) {
  let value = seed >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return { bit: value & 1, next: value >>> 0 };
}

function rateLimitMetadata(headers) {
  const keys = [
    "x-ratelimit-limit-requests",
    "x-ratelimit-remaining-requests",
    "x-ratelimit-limit-tokens",
    "x-ratelimit-remaining-tokens",
    "x-ratelimit-reset-requests",
    "x-ratelimit-reset-tokens",
  ];
  return Object.fromEntries(keys.map((key) => [key, headers?.get?.(key) ?? null]));
}

function createCapturedClient(realClient, variant, metadata) {
  return {
    chat: {
      completions: {
        async create(request, requestOptions) {
          const messages = applyPromptVariant(request.messages, variant);
          metadata.requestStartedAt = new Date().toISOString();
          metadata.systemPromptSha256 = sha256(messages.find((message) => message.role === "system")?.content ?? "");
          metadata.userPromptSha256 = sha256(messages.find((message) => message.role === "user")?.content ?? "");
          metadata.fullMessagesSha256 = sha256(canonical(messages));
          metadata.requestContractSha256 = sha256(canonical({
            model: request.model,
            max_completion_tokens: request.max_completion_tokens,
            reasoning_effort: request.reasoning_effort,
            response_format: request.response_format,
            timeoutMs: requestOptions?.timeout,
            maxRetries: requestOptions?.maxRetries,
          }));
          const startedAt = Date.now();
          try {
            const { data, response } = await realClient.chat.completions
              .create({ ...request, messages }, requestOptions)
              .withResponse();
            metadata.httpStatus = response.status;
            metadata.rateLimits = rateLimitMetadata(response.headers);
            metadata.responseModel = data.model;
            metadata.responseId = data.id;
            metadata.responseCreated = data.created;
            metadata.finishReason = data.choices?.[0]?.finish_reason ?? null;
            metadata.usage = data.usage ? {
              inputTokens: data.usage.prompt_tokens ?? null,
              outputTokens: data.usage.completion_tokens ?? null,
              totalTokens: data.usage.total_tokens ?? null,
              queueTimeSeconds: data.usage.queue_time ?? null,
              promptTimeSeconds: data.usage.prompt_time ?? null,
              completionTimeSeconds: data.usage.completion_time ?? null,
              cachedInputTokens: data.usage.prompt_tokens_details?.cached_tokens ?? null,
            } : null;
            metadata.elapsedMs = Date.now() - startedAt;
            return data;
          } catch (error) {
            metadata.elapsedMs = Date.now() - startedAt;
            metadata.httpStatus = Number.isInteger(error?.status) ? error.status : null;
            metadata.rateLimits = rateLimitMetadata(error?.headers ?? error?.response?.headers);
            metadata.error = errorMetadata(error);
            throw error;
          }
        },
      },
    },
  };
}

function appendJsonl(outputPath, value) {
  appendFileSync(outputPath, JSON.stringify(value) + "\n", { encoding: "utf8" });
}

function parseArgs() {
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
  return {
    live: process.argv.includes("--live"),
    outputPath: outputArg ? path.resolve(outputArg.slice("--output=".length)) : null,
  };
}

const { live, outputPath: requestedOutputPath } = parseArgs();
const preflightResult = await preflight();

if (!live) {
  console.log(JSON.stringify({
    status: "preflight",
    callsPerformed: 0,
    maxCalls: preflightResult.maxCalls,
    model: preflightResult.model,
    parameters: preflightResult.parameters,
    appRevision: preflightResult.appRevision,
    fixtureCount: preflightResult.fixtures.length,
    prospectiveHoldouts: preflightResult.fixtures.filter((entry) => entry.split === "prospective_holdout").length,
  }));
  process.exit(0);
}

const apiKey = parseEnvFile();
const runId = "groq-" + new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const outputPath = requestedOutputPath ?? path.join(RUN_ROOT, runId + ".jsonl");
if (existsSync(outputPath)) throw new Error("OUTPUT_FILE_ALREADY_EXISTS");
mkdirSync(path.dirname(outputPath), { recursive: true });
const appRevision = preflightResult.appRevision;
appendJsonl(outputPath, {
  type: "manifest",
  runId,
  startedAt: new Date().toISOString(),
  provider: "Groq",
  model: MODEL,
  appRevision,
  expectedAttempts: MAX_CALLS,
  protocol: preflightResult.parameters,
  fixtures: preflightResult.fixtures,
});

const realClient = new Groq({ apiKey });
let attempts = 0;
let completed = 0;
let seed = 0x6d656866;
let lastStartedAt = 0;
let estimatedCostUpperUsd = 0;
let aborted = false;

function accountEstimate(metadata) {
  if (!metadata.usage || metadata.costEstimateRecorded) return;
  const input = metadata.usage.inputTokens;
  const output = metadata.usage.outputTokens;
  if (!Number.isFinite(input) || !Number.isFinite(output)) return;
  estimatedCostUpperUsd += input * 0.15 / 1_000_000;
  estimatedCostUpperUsd += output * 0.60 / 1_000_000;
  metadata.costEstimateRecorded = true;
  metadata.estimatedCostUpperUsd = Number(estimatedCostUpperUsd.toFixed(6));
}

for (const entry of fixtures) {
  const order = seededBit(seed);
  seed = order.next || 1;
  const variants = order.bit === 0 ? ["current", "neutral"] : ["neutral", "current"];
  for (const variant of variants) {
    if (attempts >= MAX_CALLS) throw new Error("HARD_CALL_LIMIT_REACHED");
    const waitMs = Math.max(0, MIN_GAP_MS - (Date.now() - lastStartedAt));
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastStartedAt = Date.now();
    attempts += 1;
    const metadata = {
      type: "result",
      runId,
      sequence: attempts,
      caseId: entry.id,
      split: entry.split,
      variant,
      fixtureSha256: sha256(canonical(entry.brief)),
      appRevision,
      modelRequested: MODEL,
      schemaSha256: preflightResult.parameters.responseSchemaSha256,
      maxCompletionTokens: MAX_COMPLETION_TOKENS,
      reasoningEffort: REASONING_EFFORT,
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxRetries: MAX_RETRIES,
      outcome: "started",
    };
    try {
      const tappedClient = createCapturedClient(realClient, variant, metadata);
      const proposal = await createProposalGenerator(tappedClient, MODEL)(entry.brief);
      metadata.schemaValid = true;
      metadata.proposal = sanitize(proposal);
      metadata.outcome = "success";
      completed += 1;
      accountEstimate(metadata);
      appendJsonl(outputPath, metadata);
      console.log(JSON.stringify({
        sequence: attempts,
        maxCalls: MAX_CALLS,
        caseId: entry.id,
        variant,
        outcome: metadata.outcome,
        inputTokens: metadata.usage?.inputTokens ?? null,
        outputTokens: metadata.usage?.outputTokens ?? null,
        estimatedCostUpperUsd: Number(estimatedCostUpperUsd.toFixed(6)),
      }));
    } catch (error) {
      accountEstimate(metadata);
      metadata.schemaValid = metadata.responseModel ? false : null;
      metadata.outcome = metadata.responseModel
        ? "invalid_model_response"
        : metadata.httpStatus
          ? "provider_error"
          : "transport_error";
      metadata.error ??= errorMetadata(error);
      appendJsonl(outputPath, metadata);
      console.log(JSON.stringify({
        sequence: attempts,
        maxCalls: MAX_CALLS,
        caseId: entry.id,
        variant,
        outcome: metadata.outcome,
        httpStatus: metadata.httpStatus ?? null,
        errorName: metadata.error?.errorName ?? null,
        estimatedCostUpperUsd: Number(estimatedCostUpperUsd.toFixed(6)),
      }));
      if (Number.isInteger(metadata.httpStatus) && metadata.httpStatus >= 400) {
        aborted = true;
        break;
      }
    }
  }
  if (aborted) break;
}

appendJsonl(outputPath, {
  type: "summary",
  runId,
  finishedAt: new Date().toISOString(),
  attempts,
  completed,
  aborted,
  estimatedCostUpperUsd: Number(estimatedCostUpperUsd.toFixed(6)),
  outputPath,
});
console.log(JSON.stringify({
  status: aborted ? "aborted" : "finished",
  runId,
  attempts,
  completed,
  maxCalls: MAX_CALLS,
  estimatedCostUpperUsd: Number(estimatedCostUpperUsd.toFixed(6)),
  outputPath,
}));

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { generateProposal } from "@/lib/gemini";
import {
  buildPlanResult,
  eventBriefSchema,
  parseBudgetMinor,
} from "@/lib/planner";

export const maxDuration = 30;

const MAX_BODY_BYTES = 16 * 1024;
const WINDOW_MS = 20 * 60 * 1000;
const MAX_CALLS_PER_WINDOW = 4;
const callsByClient = new Map<string, { count: number; resetAt: number }>();

class RequestProblem extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new RequestProblem("The event brief is too large. Shorten the notes and try again.", 413);
  }
  if (!request.body) throw new RequestProblem("Add an event brief before generating a plan.", 400);

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let byteCount = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteCount += value.byteLength;
    if (byteCount > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RequestProblem("The event brief is too large. Shorten the notes and try again.", 413);
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RequestProblem("The event brief could not be read. Please try again.", 400);
  }
}

function takeGenerationSlot(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientKey = (forwarded || request.headers.get("x-real-ip") || "local").slice(0, 64);
  const now = Date.now();
  const current = callsByClient.get(clientKey);

  if (callsByClient.size >= 2000 && !current) {
    for (const [key, entry] of callsByClient) {
      if (entry.resetAt <= now) callsByClient.delete(key);
    }
    if (callsByClient.size >= 2000) return false;
  }

  if (!current || current.resetAt <= now) {
    callsByClient.set(clientKey, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_CALLS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

export async function POST(request: Request) {
  try {
    const input = await readJsonBody(request);
    const parsed = eventBriefSchema.safeParse(input);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: parsed.error.issues[0]?.message ?? "Check the event brief and try again." } },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    let totalMinor: number;
    try {
      totalMinor = parseBudgetMinor(parsed.data.budgetAmount, parsed.data.currency);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Check the budget amount and currency.";
      return NextResponse.json(
        { error: { message } },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: { code: "PROVIDER_NOT_CONFIGURED", message: "AI planning is not connected yet. Add a Gemini API key to the server environment to generate a live plan." } },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!takeGenerationSlot(request)) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "This app instance has reached its short-term generation limit. Please try again later." } },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "1200" } },
      );
    }

    const proposal = await generateProposal(parsed.data);
    const result = buildPlanResult(proposal, parsed.data.currency, totalMinor);
    return NextResponse.json(
      { result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RequestProblem) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { message: "The planning service returned a draft that did not meet the required structure. Your brief is unchanged; try again." } },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { error: { message: "The planning service could not create a draft. Your brief is unchanged; please try again." } },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

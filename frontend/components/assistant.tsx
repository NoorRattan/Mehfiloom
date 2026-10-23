"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Check,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import {
  eventBriefSchema,
  parseBudgetMinor,
  type EventBrief,
  type PlanResult,
} from "@/lib/planner";
import { events, type EventKind } from "@/lib/events";
import { useWorkspace, planResultSchema } from "@/lib/workspace-store";
import BriefFields from "./brief-fields";
import { Flower } from "./chrome";
import { PlanResultView } from "./plan-result";

export default function Assistant({ kind }: { kind: EventKind }) {
  const { state, update } = useWorkspace(kind);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const controller = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<HTMLFormElement>(null);
  const data = events[kind];
  useEffect(() => () => controller.current?.abort(), []);
  function change<K extends keyof EventBrief>(key: K, value: EventBrief[K]) {
    update((current) => ({
      ...current,
      brief: { ...current.brief, [key]: value },
    }));
  }
  async function generate(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("");
    if (!contextRef.current?.reportValidity()) {
      setError(
        "Add your celebration name, location, guest estimate, and budget in the little details first.",
      );
      return;
    }
    const validated = eventBriefSchema.safeParse(state.brief);
    if (!validated.success) {
      setError(
        validated.error.issues[0]?.message ??
          "Please check your event details.",
      );
      return;
    }
    try {
      parseBudgetMinor(state.brief.budgetAmount, state.brief.currency);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check your budget.");
      return;
    }
    const requestText =
      prompt.trim() ||
      `Create a thoughtful, personalised ${data.singular} plan from these details.`;
    if (state.revisionRequests.length >= 20) {
      setError(
        "This plan has reached 20 revisions. Export your current plan, then change the details and create a fresh plan.",
      );
      return;
    }
    setBusy(true);
    const abort = new AbortController();
    controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 45000);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: validated.data,
          revisionRequest: requestText,
          priorRevisionRequests: state.revisionRequests,
        }),
        signal: abort.signal,
      });
      const body = (await response.json()) as {
        result?: PlanResult;
        error?: { message?: string };
      };
      if (!response.ok || !body.result)
        throw new Error(
          body.error?.message ??
            "We couldn’t create your plan. Please try again.",
        );
      if (!planResultSchema.safeParse(body.result).success)
        throw new Error(
          "The planning service returned an incomplete plan. Please try again.",
        );
      update((current) => ({
        ...current,
        result: body.result!,
        resultSource: "ai",
        revisionRequests: [...current.revisionRequests, requestText],
      }));
      setPrompt("");
      setStatus("Your tailored plan is ready and saved to your organizer.");
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
          block: "start",
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error && e.name === "AbortError"
          ? "The request took too long. Your draft is safe; please try again."
          : e instanceof Error
            ? e.message
            : "Something went wrong. Please try again.",
      );
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
      controller.current = null;
    }
  }
  return (
    <main
      id="main"
      className={`workspace-main assistant-main workspace-${kind} wrap`}
    >
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">
            <Sparkles size={13} /> YOUR{" "}
            {kind === "community" ? "GATHERING" : kind.toUpperCase()} AI
            ASSISTANT
          </p>
          <h1>{data.assistantTitle}</h1>
          <p>{data.assistantIntro}</p>
        </div>
        <Link href={`/${kind}/organize`} className="text-link">
          Back to your organizer <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="assistant-grid">
        <aside className="assistant-context">
          <div className="panel-title">
            <h2>The little details</h2>
            <span>YOUR BRIEF</span>
          </div>
          <p>A little context makes for a much better plan.</p>
          <form ref={contextRef} onSubmit={(e) => e.preventDefault()}>
            <fieldset disabled={busy}>
              <BriefFields
                brief={state.brief}
                onChange={change}
                kind={kind}
                compact
              />
            </fieldset>
          </form>
          <span className="save-note">
            <span /> Stored on this browser
          </span>
        </aside>
        <div className="assistant-conversation">
          <div className="assistant-welcome">
            <div className="assistant-avatar">
              <Flower />
              <span className="online-dot" />
            </div>
            <p className="eyebrow">IDEAS, MEET POSSIBILITIES.</p>
            <h2>
              {kind === "wedding" ? (
                <>
                  A day to remember.
                  <br />
                  <em>Let’s start dreaming.</em>
                </>
              ) : kind === "birthday" ? (
                <>
                  A spark of an idea.
                  <br />
                  <em>A whole lot of fun.</em>
                </>
              ) : (
                <>
                  Your people. Your purpose.
                  <br />
                  <em>Let’s bring it to life.</em>
                </>
              )}
            </h2>
            <p>
              {state.resultSource === "ai"
                ? "Your plan is saved below. Tell me what you’d like to change."
                : "Tell me what you’re imagining. We’ll give it a little shape, together."}
            </p>
            <div className="prompt-suggestions">
              {data.prompts.map((suggestion) => (
                <button
                  key={suggestion}
                  disabled={busy}
                  onClick={() => {
                    setPrompt(suggestion);
                    document.getElementById("assistant-prompt")?.focus();
                  }}
                >
                  {suggestion}
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          </div>
          <form className="assistant-composer" onSubmit={generate}>
            <label htmlFor="assistant-prompt" className="sr-only">
              Describe your celebration or request a change
            </label>
            <textarea
              id="assistant-prompt"
              value={prompt}
              disabled={busy}
              onChange={(e) => setPrompt(e.target.value)}
              minLength={8}
              maxLength={500}
              rows={3}
              placeholder={
                state.resultSource === "ai"
                  ? "What would you like to refine?"
                  : "A little about the day you have in mind…"
              }
            />
            <div>
              <span>
                <Sparkles size={13} /> A plan with your personality.
              </span>
              <button
                className="send-button"
                type="submit"
                disabled={busy}
                aria-label={
                  busy ? "Creating your plan" : "Create your tailored plan"
                }
              >
                {busy ? (
                  <LoaderCircle size={18} className="loading-spin" />
                ) : (
                  <ArrowUp size={20} />
                )}
              </button>
            </div>
          </form>
          <p className="assistant-disclosure">
            Creating a plan sends this brief to the planning service. Skip
            private guest details.
            <br />
            Ideas and allocations are starting points; confirm costs and
            availability with vendors.
          </p>
          {busy && (
            <p className="generation-progress" role="status">
              <LoaderCircle className="loading-spin" size={16} />
              Finding the threads that bring your day together…
            </p>
          )}
          {error && (
            <div className="error-message" role="alert">
              <strong>A little pause.</strong>
              <p>{error}</p>
            </div>
          )}
          {state.revisionRequests.length >= 20 && !busy && (
            <button
              className="button button-outline"
              onClick={() => {
                update((current) => ({
                  ...current,
                  result: null,
                  resultSource: null,
                  revisionRequests: [],
                }));
                setPrompt("");
                setError("");
                setStatus(
                  "Ready for a fresh planning round. Your event details, tasks and vendor notes are kept.",
                );
              }}
            >
              Start a fresh planning round
            </button>
          )}
          {status && (
            <p className="success-message" role="status">
              <Check size={16} />
              {status}
            </p>
          )}
          <div ref={resultRef} className="assistant-result-anchor">
            {state.result && state.resultSource === "ai" && (
              <PlanResultView result={state.result} kind={kind} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

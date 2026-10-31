"use client";

import { useRef } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Check,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { events, type EventKind } from "@/lib/events";
import { usePlanGeneration } from "@/lib/use-plan-generation";
import BriefFields from "./brief-fields";
import { Flower } from "./chrome";
import { PlanResultView } from "./plan-result";
import WorkspaceStorageStatus from "./workspace-storage-status";

export default function Assistant({ kind }: { kind: EventKind }) {
  return <AssistantWorkspace key={kind} kind={kind} />;
}

function AssistantWorkspace({ kind }: { kind: EventKind }) {
  const {
    state,
    storageStatus,
    prompt,
    setPrompt,
    busy,
    error,
    status,
    change,
    generate,
    cancel,
    startFresh,
    canStartFresh,
  } = usePlanGeneration(kind);
  const resultRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<HTMLFormElement>(null);
  const data = events[kind];
  function revealResult() {
    requestAnimationFrame(() => {
      resultRef.current?.focus({ preventScroll: true });
      resultRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    });
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
            <h2 id={`${kind}-brief-heading`}>The little details</h2>
            <span>YOUR BRIEF</span>
          </div>
          <p>A little context makes for a much better plan.</p>
          <form ref={contextRef} onSubmit={(e) => e.preventDefault()}>
            <fieldset disabled={busy} aria-labelledby={`${kind}-brief-heading`}>
              <BriefFields
                brief={state.brief}
                onChange={change}
                kind={kind}
                compact
              />
            </fieldset>
          </form>
          <WorkspaceStorageStatus status={storageStatus} kind={kind} />
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
                ? "Your current plan is below. Tell me what you’d like to change."
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
          <form
            className="assistant-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void generate(
                contextRef.current?.reportValidity() ?? false,
                revealResult,
              );
            }}
          >
            <label htmlFor="assistant-prompt" className="sr-only">
              Describe your celebration or request a change
            </label>
            <textarea
              id="assistant-prompt"
              aria-describedby="assistant-disclosure"
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
          <p id="assistant-disclosure" className="assistant-disclosure">
            Creating a plan sends this brief to the planning service. Skip
            private guest details.
            <br />
            Ideas and allocations are starting points; confirm costs and
            availability with vendors.
          </p>
          {busy && (
            <div>
              <p className="generation-progress" role="status">
                <LoaderCircle className="loading-spin" size={16} />
                Finding the threads that bring your day together…
              </p>
              <button className="text-link" type="button" onClick={cancel}>
                Cancel planning
              </button>
            </div>
          )}
          {error && (
            <div className="error-message" role="alert">
              <strong>A little pause.</strong>
              <p>{error}</p>
            </div>
          )}
          {canStartFresh && !busy && (
            <button className="button button-outline" onClick={startFresh}>
              Start a fresh planning round
            </button>
          )}
          {status && (
            <p className="success-message" role="status">
              <Check size={16} />
              {status}
            </p>
          )}
          <div
            ref={resultRef}
            className="assistant-result-anchor"
            tabIndex={-1}
            role="region"
            aria-label="Your planning result"
          >
            {state.result && state.resultSource === "ai" && (
              <PlanResultView result={state.result} kind={kind} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

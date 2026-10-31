"use client";

import { useEffect, useRef, useState } from "react";
import {
  eventBriefSchema,
  parseBudgetMinor,
  type EventBrief,
} from "@/lib/planner";
import {
  MAX_GENERATION_BODY_BYTES,
  MAX_REVISION_REQUESTS,
} from "../../backend/lib/planning-limits";
import { events, type EventKind } from "./events";
import { readGenerationResponse } from "./generation-client";
import { useWorkspace, type Workspace } from "./workspace-store";

type GenerationFeedback =
  | { phase: "idle" | "pending" }
  | { phase: "ready" | "cancelled"; message: string }
  | { phase: "error"; message: string; recoverWithFreshRound?: boolean };

function planningSnapshot(state: Workspace): string {
  return JSON.stringify([state.brief, state.result, state.revisionRequests]);
}

/** Owns admission, cancellation and conflict-safe result application for one event. */
export function usePlanGeneration(kind: EventKind) {
  const workspace = useWorkspace(kind);
  const { state, update } = workspace;
  const [prompt, setPrompt] = useState("");
  const [feedback, setFeedback] = useState<GenerationFeedback>({
    phase: "idle",
  });
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      const pending = controller.current;
      controller.current = null;
      pending?.abort();
    },
    [kind],
  );

  function change<K extends keyof EventBrief>(key: K, value: EventBrief[K]) {
    update((current) => ({
      ...current,
      brief: { ...current.brief, [key]: value },
    }));
  }
  function fail(message: string) {
    setFeedback({ phase: "error", message });
  }
  async function generate(
    detailsValid: boolean,
    onReady: () => void,
  ): Promise<void> {
    // The ref also blocks two submissions before React commits a pending render.
    if (controller.current) return;
    if (!detailsValid) {
      fail(
        "Add your celebration name, location, guest estimate, and budget in the little details first.",
      );
      return;
    }
    const validated = eventBriefSchema.safeParse(state.brief);
    if (!validated.success) {
      fail(
        validated.error.issues[0]?.message ??
          "Please check your event details.",
      );
      return;
    }
    try {
      parseBudgetMinor(validated.data.budgetAmount, validated.data.currency);
    } catch (problem) {
      fail(problem instanceof Error ? problem.message : "Check your budget.");
      return;
    }
    if (state.revisionRequests.length >= MAX_REVISION_REQUESTS) {
      fail(
        `This plan has reached ${MAX_REVISION_REQUESTS} revisions. Export your current plan, then change the details and create a fresh plan.`,
      );
      return;
    }
    const requestText =
      prompt.trim() ||
      `Create a thoughtful, personalised ${events[kind].singular} plan from these details.`;
    const body = JSON.stringify({
      brief: validated.data,
      revisionRequest: requestText,
      priorRevisionRequests: state.revisionRequests,
    });
    if (new TextEncoder().encode(body).byteLength > MAX_GENERATION_BODY_BYTES) {
      setFeedback({
        phase: "error",
        message:
          "These event details and revision history are too long to send. Shorten your brief, or export your plan and start a fresh planning round.",
        recoverWithFreshRound: state.revisionRequests.length > 0,
      });
      return;
    }
    const startingPlan = planningSnapshot(state);
    const abort = new AbortController();
    controller.current = abort;
    setFeedback({ phase: "pending" });
    const timeout = window.setTimeout(() => abort.abort(), 45_000);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: abort.signal,
      });
      const result = await readGenerationResponse(response);
      if (controller.current !== abort) return;
      if (abort.signal.aborted) throw abort.signal.reason;
      let applied = false;
      const accepted = update((current) => {
        if (planningSnapshot(current) !== startingPlan) return current;
        applied = true;
        return {
          ...current,
          result,
          resultSource: "ai",
          revisionRequests: [...current.revisionRequests, requestText],
        };
      });
      if (!accepted) {
        setFeedback({ phase: "idle" });
        return;
      }
      if (!applied) {
        fail(
          "Your draft changed while this plan was being created. Your newer details are safe; create a plan again with the updated brief.",
        );
        return;
      }
      setPrompt("");
      setFeedback({
        phase: "ready",
        message: "Your tailored plan is ready in your organizer.",
      });
      onReady();
    } catch (problem) {
      if (controller.current !== abort) return;
      if (abort.signal.reason === "host-cancelled") {
        setFeedback({
          phase: "cancelled",
          message: "Planning cancelled. Your draft and previous plan are safe.",
        });
      } else {
        fail(
          abort.signal.aborted
            ? "The request took too long. Your draft is safe; please try again."
            : problem instanceof Error
              ? problem.message
              : "Something went wrong. Please try again.",
        );
      }
    } finally {
      window.clearTimeout(timeout);
      if (controller.current === abort) {
        controller.current = null;
      }
    }
  }
  function startFresh() {
    if (controller.current) return;
    const accepted = update((current) => ({
      ...current,
      result: null,
      resultSource: null,
      revisionRequests: [],
    }));
    if (!accepted) return;
    setPrompt("");
    setFeedback({
      phase: "ready",
      message:
        "Ready for a fresh planning round. Your event details, tasks and vendor notes are kept.",
    });
  }
  return {
    ...workspace,
    prompt,
    setPrompt,
    change,
    generate,
    startFresh,
    busy: feedback.phase === "pending",
    error: feedback.phase === "error" ? feedback.message : "",
    status:
      feedback.phase === "ready" || feedback.phase === "cancelled"
        ? feedback.message
        : "",
    canStartFresh:
      state.revisionRequests.length >= MAX_REVISION_REQUESTS ||
      (feedback.phase === "error" && !!feedback.recoverWithFreshRound),
    cancel: () => controller.current?.abort("host-cancelled"),
  };
}

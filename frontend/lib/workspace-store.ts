"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import {
  eventBriefSchema,
  BUDGET_CATEGORIES,
  proposalSchema,
  type EventBrief,
  type PlanResult,
} from "@/lib/planner";
import { newBrief, type EventKind } from "./events";

export const planResultSchema = z
  .object({
    proposal: proposalSchema,
    currency: z.string().regex(/^[A-Z]{3}$/),
    totalMinor: z.number().int().positive(),
    allocatedMinor: z.number().int().nonnegative(),
    lines: z.array(
      z.object({
        category: z.enum(BUDGET_CATEGORIES),
        weight: z.number(),
        rationale: z.string(),
        amountMinor: z.number().int().nonnegative(),
      }),
    ),
  })
  .refine(
    (result) =>
      result.allocatedMinor === result.totalMinor &&
      result.lines.reduce((sum, line) => sum + line.amountMinor, 0) ===
        result.totalMinor,
    "The budget allocation does not reconcile.",
  );
const savedSchema = z.object({
  brief: eventBriefSchema.safeExtend({
    eventName: z.string().max(80),
    location: z.string().max(100),
    guestCount: z.number().int().min(0).max(1000000000),
    budgetAmount: z.string().max(24),
  }),
  checked: z.array(z.string()),
  customTasks: z.array(z.string().max(120)),
  vendorNotes: z.record(z.string(), z.string().max(1000)),
  result: planResultSchema.nullable(),
  resultSource: z.enum(["starter", "ai"]).nullable(),
  revisionRequests: z.array(z.string().max(500)).max(20),
});
export type Workspace = {
  brief: EventBrief;
  checked: string[];
  customTasks: string[];
  vendorNotes: Record<string, string>;
  result: PlanResult | null;
  resultSource: "starter" | "ai" | null;
  revisionRequests: string[];
};
const memory = new Map<string, string>();
const changed = "mehfiloom:change";
function read(key: string) {
  try {
    return memory.get(key) ?? window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changed, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(changed, callback);
  };
}
export function useWorkspace(kind: EventKind) {
  const key = `mehfiloom:v2:${kind}`;
  const snapshot = useSyncExternalStore(
    subscribe,
    useCallback(() => read(key), [key]),
    () => null,
  );
  const fallback = useMemo<Workspace>(
    () => ({
      brief: newBrief(kind),
      checked: [],
      customTasks: [],
      vendorNotes: {},
      result: null,
      resultSource: null,
      revisionRequests: [],
    }),
    [kind],
  );
  const state = useMemo<Workspace>(() => {
    if (!snapshot) return fallback;
    try {
      const parsed = savedSchema.safeParse(JSON.parse(snapshot));
      return parsed.success && parsed.data.brief.eventType === kind
        ? (parsed.data as Workspace)
        : fallback;
    } catch {
      return fallback;
    }
  }, [snapshot, fallback, kind]);
  const update = useCallback(
    (updater: (current: Workspace) => Workspace) => {
      let current = fallback;
      try {
        const parsed = savedSchema.safeParse(JSON.parse(read(key) ?? "null"));
        if (parsed.success && parsed.data.brief.eventType === kind)
          current = parsed.data as Workspace;
      } catch {
        /* A damaged local draft is replaced by a fresh one. */
      }
      const value = JSON.stringify(updater(current));
      memory.set(key, value);
      try {
        window.localStorage.setItem(key, value);
        memory.delete(key);
      } catch {
        /* The current tab retains the draft when browser storage is unavailable. */
      }
      window.dispatchEvent(new Event(changed));
    },
    [fallback, key, kind],
  );
  return { state, update };
}

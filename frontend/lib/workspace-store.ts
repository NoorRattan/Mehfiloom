"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import {
  eventBriefSchema,
  currencySchema,
  buildPlanResult,
  BUDGET_CATEGORIES,
  proposalSchema,
  type EventBrief,
  type PlanResult,
} from "@/lib/planner";
import { newBrief, type EventKind } from "./events";

export const planResultSchema = z
  .object({
    proposal: proposalSchema,
    currency: currencySchema,
    totalMinor: z.number().int().positive().max(1_000_000_000_000),
    allocatedMinor: z.number().int().nonnegative().max(1_000_000_000_000),
    lines: z.array(
      z.object({
        category: z.enum(BUDGET_CATEGORIES),
        weight: z.number().int().min(1).max(1000),
        rationale: z.string().trim().min(10).max(180),
        amountMinor: z.number().int().nonnegative().max(1_000_000_000_000),
      }).strict(),
    ).min(4).max(8),
  }).strict()
  .refine(
    (result) =>
      result.allocatedMinor === result.totalMinor &&
      result.lines.reduce((sum, line) => sum + line.amountMinor, 0) ===
        result.totalMinor,
    "The budget allocation does not reconcile.",
  )
  .refine((result) => {
    try {
      // Validate proposal categories and reserve, while retaining host-edited amounts.
      const expected = buildPlanResult(result.proposal, result.currency, result.totalMinor);
      const lines = new Map(result.lines.map((line) => [line.category, line]));
      return lines.size === result.lines.length &&
        lines.size === expected.lines.length &&
        expected.lines.every((line) => {
          const saved = lines.get(line.category);
          return saved?.weight === line.weight && saved.rationale === line.rationale;
        });
    } catch {
      return false;
    }
  }, "Budget lines must match the proposal categories and include a reserve.");
const savedSchema = z.object({
  brief: eventBriefSchema.safeExtend({
    eventName: z.string().max(80),
    location: z.string().max(100),
    guestCount: z.number().int().min(0).max(1000000000),
    budgetAmount: z.string().max(24),
    // A draft must retain spaces while the host is still typing a sentence.
    style: z.string().max(500),
    mustHaves: z.string().max(700),
  }),
  checked: z.array(z.string().max(120)),
  customTasks: z.array(z.string().min(1).max(120)).max(50),
  vendorNotes: z.record(z.string().max(60), z.string().max(1000)),
  // Recover a damaged generated result without discarding host-entered work.
  result: planResultSchema.nullable().catch(null),
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
// Bound parsing work even when another tab or an extension damages browser data.
const MAX_DRAFT_CHARACTERS = 250_000;
const memory = new Map<string, string>();
export type StorageStatus = "persistent" | "temporary" | "capacity";
const storageStatuses = new Map<string, StorageStatus>();
function storageStatusFor(key: string): StorageStatus {
  return storageStatuses.get(key) ?? "persistent";
}
function parseDraft(raw: string | null, kind: EventKind, fallback: Workspace): Workspace {
  if (!raw || raw.length > MAX_DRAFT_CHARACTERS) return fallback;
  try {
    const parsed = savedSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.brief.eventType !== kind) return fallback;
    const state = parsed.data;
    return {
      ...state,
      resultSource: state.result ? state.resultSource : null,
    };
  } catch {
    return fallback;
  }
}
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
  const storageStatus = useSyncExternalStore(
    subscribe,
    useCallback(() => storageStatusFor(key), [key]),
    () => "persistent" as const,
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
  const state = useMemo<Workspace>(
    () => parseDraft(snapshot, kind, fallback),
    [snapshot, fallback, kind],
  );
  const update = useCallback(
    (updater: (current: Workspace) => Workspace) => {
      const current = parseDraft(read(key), kind, fallback);
      const value = JSON.stringify(updater(current));
      if (value.length > MAX_DRAFT_CHARACTERS) {
        // Do not write a draft that the bounded reader would later discard.
        storageStatuses.set(key, "capacity");
        window.dispatchEvent(new Event(changed));
        return false;
      }
      memory.set(key, value);
      try {
        window.localStorage.setItem(key, value);
        memory.delete(key);
        storageStatuses.delete(key);
      } catch {
        // Keep usable work in this tab and make its temporary lifetime visible.
        storageStatuses.set(key, "temporary");
      }
      window.dispatchEvent(new Event(changed));
      return true;
    },
    [fallback, key, kind],
  );
  return { state, update, storageStatus };
}

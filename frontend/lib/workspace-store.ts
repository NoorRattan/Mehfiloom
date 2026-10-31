"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { newBrief, type EventKind } from "./events";
import { parseDraft, type Workspace } from "./workspace-model";
import { MAX_DRAFT_CHARACTERS } from "../../backend/lib/planning-limits";
export { planResultSchema, type Workspace } from "./workspace-model";

const memory = new Map<string, string>();
export type StorageStatus = "persistent" | "temporary" | "capacity";
const storageStatuses = new Map<string, StorageStatus>();
function storageStatusFor(key: string): StorageStatus {
  return storageStatuses.get(key) ?? "persistent";
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

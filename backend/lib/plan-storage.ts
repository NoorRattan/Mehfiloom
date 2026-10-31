import {
  LEGACY_WORKSPACE_STORAGE_KEY,
  OLDEST_WORKSPACE_STORAGE_KEY,
  OLDER_WORKSPACE_STORAGE_KEY,
  SECOND_OLDER_WORKSPACE_STORAGE_KEY,
  WORKSPACE_STORAGE_KEY,
  parseWorkspaceJson,
  serializeWorkspace,
  type Workspace,
} from "./plan-store.ts";

export interface WorkspaceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const WORKSPACE_STORAGE_KEYS = [
  WORKSPACE_STORAGE_KEY,
  LEGACY_WORKSPACE_STORAGE_KEY,
  OLDER_WORKSPACE_STORAGE_KEY,
  SECOND_OLDER_WORKSPACE_STORAGE_KEY,
  OLDEST_WORKSPACE_STORAGE_KEY,
] as const;

export function loadWorkspaceFromStorage(
  storage: Pick<WorkspaceStorage, "getItem">,
): Workspace | null {
  for (const key of WORKSPACE_STORAGE_KEYS) {
    const raw = storage.getItem(key);
    if (raw !== null) return parseWorkspaceJson(raw);
  }
  return null;
}

export function saveWorkspaceToStorage(
  storage: Pick<WorkspaceStorage, "setItem">,
  workspace: Workspace,
): void {
  storage.setItem(WORKSPACE_STORAGE_KEY, serializeWorkspace(workspace));
}

export function clearWorkspaceStorage(
  storage: Pick<WorkspaceStorage, "removeItem">,
): void {
  for (const key of WORKSPACE_STORAGE_KEYS) storage.removeItem(key);
}

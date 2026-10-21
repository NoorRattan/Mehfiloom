import {
  LEGACY_WORKSPACE_STORAGE_KEY,
  OLDEST_WORKSPACE_STORAGE_KEY,
  OLDER_WORKSPACE_STORAGE_KEY,
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

export function loadWorkspaceFromStorage(storage: Pick<WorkspaceStorage, "getItem">): Workspace | null {
  const raw = storage.getItem(WORKSPACE_STORAGE_KEY)
    ?? storage.getItem(LEGACY_WORKSPACE_STORAGE_KEY)
    ?? storage.getItem(OLDER_WORKSPACE_STORAGE_KEY)
    ?? storage.getItem(OLDEST_WORKSPACE_STORAGE_KEY);
  return raw === null ? null : parseWorkspaceJson(raw);
}

export function saveWorkspaceToStorage(
  storage: Pick<WorkspaceStorage, "setItem">,
  workspace: Workspace,
): void {
  storage.setItem(WORKSPACE_STORAGE_KEY, serializeWorkspace(workspace));
}

export function clearWorkspaceStorage(storage: Pick<WorkspaceStorage, "removeItem">): void {
  storage.removeItem(WORKSPACE_STORAGE_KEY);
  storage.removeItem(LEGACY_WORKSPACE_STORAGE_KEY);
  storage.removeItem(OLDER_WORKSPACE_STORAGE_KEY);
  storage.removeItem(OLDEST_WORKSPACE_STORAGE_KEY);
}

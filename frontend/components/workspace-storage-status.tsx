import Link from "next/link";
import type { EventKind } from "@/lib/events";
import type { StorageStatus } from "@/lib/workspace-store";

export default function WorkspaceStorageStatus({
  status,
  kind,
}: {
  status: StorageStatus;
  kind: EventKind;
}) {
  if (status === "persistent") {
    return (
      <p className="save-note">
        <span aria-hidden="true" /> Stored on this browser · no account needed
      </p>
    );
  }
  return (
    <div className="error-message" role="status">
      <p>
        {status === "temporary"
          ? "Browser storage is unavailable. Changes are kept only in this tab. Export a copy before leaving or closing this tab."
          : "This draft has reached its storage limit. Your latest change was not saved. Export a copy before adding more."}
      </p>
      <Link className="text-link" href={`/${kind}/organize`}>
        Open your organizer to export a copy
      </Link>
    </div>
  );
}

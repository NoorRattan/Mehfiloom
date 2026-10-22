import { CircleAlert } from "lucide-react";
import type { PendingPlanRevision } from "@/lib/plan-revisions";

type RevisionReviewPanelProps = {
  pendingRevision: PendingPlanRevision;
  isStale: boolean;
  onAccept: () => void;
  onDiscard: () => void;
};

export function RevisionReviewPanel({
  pendingRevision,
  isStale,
  onAccept,
  onDiscard,
}: RevisionReviewPanelProps) {
  return (
    <section className="revision-review" aria-labelledby="revision-review-title">
      <div className="revision-review-heading">
        <div>
          <span className="section-label">REVIEW BEFORE APPLYING</span>
          <h3 id="revision-review-title">Revision {pendingRevision.basePlan.revisionNumber + 1}</h3>
        </div>
        <span className="revision-version">
          v{pendingRevision.basePlan.revisionNumber} → v{pendingRevision.basePlan.revisionNumber + 1}
        </span>
      </div>
      <p className="revision-request-summary"><strong>Your request</strong> {pendingRevision.request}</p>
      <ul className="revision-change-list">
        {pendingRevision.changes.map((change) => (
          <li key={change.title}><strong>{change.title}</strong><span>{change.detail}</span></li>
        ))}
      </ul>
      <p className="revision-preservation-note">
        Accepting recalculates the budget from the new brief and resets the review if its cap, allocation,
        or cost lines change. Recorded costs, payments, guest counts, task progress, vendor notes, and
        host-edited title, overview, or theme are carried forward.
      </p>
      {isStale && (
        <div className="form-error" role="alert">
          <CircleAlert size={16} />
          <span>This plan changed while the revision was being drafted. Discard the stale draft and request a fresh revision.</span>
        </div>
      )}
      <div className="revision-actions">
        <button className="revision-accept-button" type="button" onClick={onAccept} disabled={isStale}>
          Accept revision
        </button>
        <button className="revision-discard-button" type="button" onClick={onDiscard}>
          Discard revision
        </button>
      </div>
    </section>
  );
}

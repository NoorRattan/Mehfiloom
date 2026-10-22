type PlanVerificationNoticeProps = {
  mustHaves: string;
  modelGenerated: boolean;
};

export function PlanVerificationNotice({ mustHaves, modelGenerated }: PlanVerificationNoticeProps) {
  return (
    <aside className="plan-verification-notice" aria-labelledby="plan-verification-heading">
      <span className="section-label">HOST REVIEW REQUIRED</span>
      <h3 id="plan-verification-heading">Treat this as a planning draft</h3>
      <p>
        {modelGenerated
          ? "Model-generated suggestions are not verified facts. "
          : "Example suggestions use synthetic content and are not verified facts. "}
        Check every suggestion against your must-haves and opt-outs. This app does not verify affordability,
        prices, venue capacity or permissions, local requirements, or availability for your event date.
        Confirm food ingredients and cross-contact controls directly with providers before relying on them
        for an allergy or dietary need.
      </p>
      <p><strong>Must-haves to check:</strong> {mustHaves.trim() || "None recorded. Add any hard requirements before relying on this draft."}</p>
    </aside>
  );
}

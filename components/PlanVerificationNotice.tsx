export function PlanVerificationNotice() {
  return (
    <aside className="plan-verification-notice" aria-labelledby="plan-verification-heading">
      <span className="section-label">HOST REVIEW REQUIRED</span>
      <h3 id="plan-verification-heading">Treat this as a planning draft</h3>
      <p>
        Check every suggestion against your must-haves and opt-outs. This app does not verify prices,
        venue capacity or permissions, local requirements, or availability for your event date. Confirm
        food ingredients and cross-contact controls directly with providers before relying on them for
        an allergy or dietary need.
      </p>
    </aside>
  );
}

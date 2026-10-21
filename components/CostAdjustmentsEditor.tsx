"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/planner";
import { forecastCostItem, type CostAdjustment, type CostItem } from "@/lib/plan-store";

export type CostAdjustmentDraft = {
  kind: CostAdjustment["kind"];
  label: string;
  pricingModel: CostAdjustment["pricingModel"];
  amount: string;
  amountMax: string;
  sourceNote: string;
};

type ChargeField = "feesIncluded" | "taxesIncluded";

type CostAdjustmentsEditorProps = {
  cost: CostItem;
  expectedGuests: number;
  currency: string;
  editing: boolean;
  onSave: (id: string | null, draft: CostAdjustmentDraft) => boolean;
  onRemove: (id: string) => boolean;
  onChargeStatus: (field: ChargeField, value: boolean | null) => boolean;
  onReview: (checked: boolean) => boolean;
};

const KIND_LABELS: Record<CostAdjustment["kind"], string> = {
  discount: "Discount",
  fee: "Fee",
  tax: "Tax",
};

function amountInput(amountMinor: number | null, currency: string): string {
  if (amountMinor === null) return "";
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return (amountMinor / 10 ** digits).toFixed(digits).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function draftFrom(adjustment: CostAdjustment, currency: string): CostAdjustmentDraft {
  return {
    kind: adjustment.kind,
    label: adjustment.label,
    pricingModel: adjustment.pricingModel,
    amount: amountInput(adjustment.amountMinor, currency),
    amountMax: amountInput(adjustment.amountMaxMinor, currency),
    sourceNote: adjustment.sourceNote,
  };
}

function emptyDraft(): CostAdjustmentDraft {
  return { kind: "fee", label: "", pricingModel: "fixed", amount: "", amountMax: "", sourceNote: "" };
}

function moneyRange(lower: number, upper: number, currency: string): string {
  return lower === upper
    ? formatMoney(lower, currency)
    : `${formatMoney(lower, currency)}–${formatMoney(upper, currency)}`;
}

function statusLabel(value: boolean | null): string {
  return value === null ? "Unknown" : value ? "Included" : "Separate amount";
}

function AdjustmentFields({
  draft,
  currency,
  onChange,
}: {
  draft: CostAdjustmentDraft;
  currency: string;
  onChange: (field: keyof CostAdjustmentDraft, value: string) => void;
}) {
  return (
    <div className="adjustment-fields">
      <label>Type<select value={draft.kind} onChange={(event) => onChange("kind", event.target.value)}>
        <option value="discount">Discount</option><option value="fee">Fee</option><option value="tax">Tax</option>
      </select></label>
      <label>Source line<input value={draft.label} minLength={2} maxLength={80} onChange={(event) => onChange("label", event.target.value)} placeholder="e.g. Delivery fee" /></label>
      <label>Amount basis<select value={draft.pricingModel} onChange={(event) => onChange("pricingModel", event.target.value)}>
        <option value="fixed">Fixed total</option><option value="per_guest">Per guest</option>
      </select></label>
      <label>Lower amount ({currency})<input inputMode="decimal" value={draft.amount} onChange={(event) => onChange("amount", event.target.value)} placeholder="e.g. 0" /></label>
      <label>Upper amount ({currency})<input inputMode="decimal" value={draft.amountMax} onChange={(event) => onChange("amountMax", event.target.value)} placeholder="Same as lower" /></label>
      <label className="adjustment-source">Source and notes<input value={draft.sourceNote} minLength={3} maxLength={300} onChange={(event) => onChange("sourceNote", event.target.value)} placeholder="Who stated this amount?" /></label>
    </div>
  );
}

function ExistingAdjustment({
  adjustment,
  currency,
  editing,
  onSave,
  onRemove,
}: {
  adjustment: CostAdjustment;
  currency: string;
  editing: boolean;
  onSave: (draft: CostAdjustmentDraft) => boolean;
  onRemove: () => boolean;
}) {
  const [draft, setDraft] = useState(() => draftFrom(adjustment, currency));
  const change = (field: keyof CostAdjustmentDraft, value: string) => setDraft((current) => ({ ...current, [field]: value }));

  if (!editing) {
    const upper = adjustment.amountMaxMinor ?? adjustment.amountMinor;
    const suffix = adjustment.pricingModel === "per_guest" ? " per guest" : "";
    return (
      <li className="adjustment-read-row">
        <span><strong>{KIND_LABELS[adjustment.kind]} · {adjustment.label}</strong><small>{formatMoney(adjustment.amountMinor, currency)}{upper !== adjustment.amountMinor ? `–${formatMoney(upper, currency)}` : ""}{suffix} · {adjustment.sourceNote}</small></span>
      </li>
    );
  }

  return (
    <li className="adjustment-edit-row">
      <AdjustmentFields draft={draft} currency={currency} onChange={change} />
      <div className="adjustment-row-actions">
        <button type="button" onClick={() => onSave(draft)}>Save line</button>
        <button className="adjustment-remove" type="button" onClick={onRemove}>Remove line</button>
      </div>
    </li>
  );
}

export function CostAdjustmentsEditor({
  cost,
  expectedGuests,
  currency,
  editing,
  onSave,
  onRemove,
  onChargeStatus,
  onReview,
}: CostAdjustmentsEditorProps) {
  const [newDraft, setNewDraft] = useState(emptyDraft);
  const forecast = forecastCostItem(cost, expectedGuests);
  const changeNewDraft = (field: keyof CostAdjustmentDraft, value: string) => setNewDraft((current) => ({ ...current, [field]: value }));
  const baseTotal = forecast.baseLowerMinor === null || forecast.baseUpperMinor === null
    ? "Unknown"
    : moneyRange(forecast.baseLowerMinor, forecast.baseUpperMinor, currency);
  const adjustedTotal = forecast.lowerMinor === null || forecast.upperMinor === null
    ? "Unknown until the base amount is recorded"
    : moneyRange(forecast.lowerMinor, forecast.upperMinor, currency);

  return (
    <section className="cost-adjustments" aria-label={`Fees, taxes, and discounts for ${cost.label}`}>
      <div className="adjustment-heading"><div><strong>Fees, taxes &amp; discounts</strong><small>Use amounts from a named source. No percentage or tax rule is inferred.</small></div></div>
      <div className="adjustment-status-grid">
        {(["feesIncluded", "taxesIncluded"] as const).map((field) => (
          <label key={field}>{field === "feesIncluded" ? "Fees" : "Taxes"}
            {editing ? <select value={cost[field] === null ? "unknown" : cost[field] ? "included" : "excluded"} onChange={(event) => onChargeStatus(field, event.target.value === "unknown" ? null : event.target.value === "included")}>
              <option value="unknown">Unknown</option><option value="included">Included</option><option value="excluded">Separate amount</option>
            </select> : <span>{statusLabel(cost[field])}</span>}
          </label>
        ))}
      </div>
      <div className="adjustment-rollup">
        <span>Base <strong>{baseTotal}</strong></span>
        <span>Discounts <strong>{moneyRange(forecast.discountLowerMinor, forecast.discountUpperMinor, currency)}</strong></span>
        <span>Fees <strong>{moneyRange(forecast.feeLowerMinor, forecast.feeUpperMinor, currency)}</strong></span>
        <span>Taxes <strong>{moneyRange(forecast.taxLowerMinor, forecast.taxUpperMinor, currency)}</strong></span>
        <span className="adjustment-final">Adjusted forecast <strong>{adjustedTotal}</strong></span>
      </div>
      {cost.adjustments.length > 0 ? <ul className="adjustment-list">
        {cost.adjustments.map((adjustment) => <ExistingAdjustment
          key={`${adjustment.id}:${adjustment.kind}:${adjustment.label}:${adjustment.pricingModel}:${adjustment.amountMinor}:${adjustment.amountMaxMinor ?? ""}:${adjustment.sourceNote}:${currency}`}
          adjustment={adjustment}
          currency={currency}
          editing={editing}
          onSave={(draft) => onSave(adjustment.id, draft)}
          onRemove={() => onRemove(adjustment.id)}
        />)}
      </ul> : <p className="adjustment-empty">No separate adjustment amounts recorded.</p>}
      {editing && <div className="adjustment-add-form">
        <h4>Add a sourced amount</h4>
        <AdjustmentFields draft={newDraft} currency={currency} onChange={changeNewDraft} />
        <button type="button" onClick={() => { if (onSave(null, newDraft)) setNewDraft(emptyDraft()); }}>Add adjustment</button>
      </div>}
      {editing && cost.amountMinor !== null && <label className="checkbox-field adjustment-review"><input type="checkbox" checked={cost.chargesReviewed} onChange={(event) => onReview(event.target.checked)} /> I checked the source for both fees and taxes.</label>}
      {!editing && <p className="adjustment-review-state">{cost.chargesReviewed ? "Fee and tax source reviewed." : cost.mandatory ? "Mandatory charge review is incomplete." : "Review fees and taxes before relying on this forecast."}</p>}
      <p className="adjustment-formula">Adjusted total = base − discounts + fees + taxes. Per-guest amounts use the cost&apos;s billed guest count, including its minimum.</p>
    </section>
  );
}

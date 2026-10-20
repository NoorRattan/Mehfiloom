"use client";

import type { CostItem } from "@/lib/plan-store";
import { formatMoney } from "@/lib/planner";

export type PaymentDraft = { amount: string; paidAt: string; note: string };

type Props = {
  cost: CostItem;
  currency: string;
  editing: boolean;
  draft: PaymentDraft;
  onDraftChange: (field: keyof PaymentDraft, value: string) => void;
  onAdd: () => void;
  onRemove: (paymentId: string) => void;
};

export function PaymentHistoryPanel({ cost, currency, editing, draft, onDraftChange, onAdd, onRemove }: Props) {
  return (
    <section className="payment-history" aria-label={`Payment history for ${cost.label}`}>
      <div className="payment-history-heading">
        <strong>Payment history</strong>
        <span>{formatMoney(cost.paidMinor, currency)} paid</span>
      </div>
      {cost.payments.length > 0 ? (
        <ul>
          {cost.payments.map((payment) => (
            <li key={payment.id}>
              <span>{payment.paidAt || "Date not recorded"}{payment.note ? ` · ${payment.note}` : ""}</span>
              <strong>{formatMoney(payment.amountMinor, currency)}</strong>
              {editing && <button type="button" onClick={() => onRemove(payment.id)} aria-label={`Remove payment of ${formatMoney(payment.amountMinor, currency)}`}>Remove</button>}
            </li>
          ))}
        </ul>
      ) : <p>No payments recorded.</p>}
      {editing && cost.evidence === "committed" && (
        <form className="payment-entry" onSubmit={(event) => { event.preventDefault(); onAdd(); }}>
          <label>Amount ({currency})<input required inputMode="decimal" value={draft.amount} onChange={(event) => onDraftChange("amount", event.target.value)} placeholder="e.g. 5000" /></label>
          <label>Paid on<input type="date" value={draft.paidAt} onChange={(event) => onDraftChange("paidAt", event.target.value)} /></label>
          <label>Note<input maxLength={160} value={draft.note} onChange={(event) => onDraftChange("note", event.target.value)} placeholder="Deposit, installment…" /></label>
          <button type="submit">Record payment</button>
        </form>
      )}
    </section>
  );
}

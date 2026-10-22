import { ChevronDown, CircleCheck, Store } from "lucide-react";
import { BUDGET_CATEGORIES, CATEGORY_LABELS, formatMoney, type PlanResult } from "@/lib/planner";
import type { VendorRecord } from "@/lib/plan-store";

type BudgetAllocationPanelProps = {
  lines: PlanResult["lines"];
  totalMinor: number;
  currency: string;
};

export function BudgetAllocationPanel({ lines, totalMinor, currency }: BudgetAllocationPanelProps) {
  return (
    <div className="budget-surface">
      <div className="budget-topline">
        <span><CircleCheck size={16} /> Allocation adds up to your cap</span>
        <small>Planning targets · not vendor quotes</small>
      </div>
      <div className="budget-grid">
        {lines.map((line, index) => {
          const percentage = Math.max(0, Math.min(100, (line.amountMinor / Math.max(totalMinor, 1)) * 100));
          const category = BUDGET_CATEGORIES.find((item) => item === line.category);

          return (
            <div className="budget-line" key={`${line.category}-${index}`}>
              <div className="budget-line-head">
                <span>{category ? CATEGORY_LABELS[category] : line.category}</span>
                <strong>{formatMoney(line.amountMinor, currency)}</strong>
              </div>
              <div className="budget-track">
                <span className={`budget-fill fill-${index % 5}`} style={{ width: `${percentage}%` }} />
              </div>
              <p>{line.rationale}</p>
            </div>
          );
        })}
      </div>
      <div className="budget-footnote">
        The split comes from relative priorities and exact arithmetic. Local costs, tax, and vendor availability still need checking.
      </div>
    </div>
  );
}

type VendorChecklistSectionProps = {
  vendors: VendorRecord[];
  editing: boolean;
  onUpdateVendor: (vendorId: string, update: (current: VendorRecord) => VendorRecord) => void;
};

export function VendorChecklistSection({ vendors, editing, onUpdateVendor }: VendorChecklistSectionProps) {
  return (
    <section className="vendors-section">
      <div className="section-heading compact-heading">
        <div>
          <span className="section-label">ASK BEFORE YOU BOOK</span>
          <h3>Vendor checklist</h3>
        </div>
        <span className="soft-icon"><Store size={16} /></span>
      </div>
      <div className="vendor-list">
        {vendors.map((vendor) => (
          <details className="vendor-accordion" key={vendor.id}>
            <summary>
              <span>{vendor.category}{vendor.name ? ` · ${vendor.name}` : ""}</span>
              <ChevronDown size={15} />
            </summary>
            <div className="vendor-detail">
              <ul>
                {vendor.questions.map((question, questionIndex) => <li key={questionIndex}>{question}</li>)}
              </ul>
              {editing ? (
                <div className="vendor-edit-grid">
                  <label>Vendor name
                    <input value={vendor.name ?? ""} maxLength={80} onChange={(event) => onUpdateVendor(vendor.id, (current) => ({ ...current, name: event.target.value || null }))} />
                  </label>
                  <label>Availability
                    <select value={vendor.availability} onChange={(event) => onUpdateVendor(vendor.id, (current) => ({ ...current, availability: event.target.value as VendorRecord["availability"], checkedAt: new Date().toISOString() }))}>
                      <option value="unknown">Unknown</option>
                      <option value="inquiry_pending">Inquiry sent</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="expired">Expired</option>
                    </select>
                  </label>
                  <label>Booking
                    <select value={vendor.booking} onChange={(event) => onUpdateVendor(vendor.id, (current) => ({ ...current, booking: event.target.value as VendorRecord["booking"] }))}>
                      <option value="not_booked">Not booked</option>
                      <option value="host_recorded">Host says booked</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </label>
                  <label>Notes
                    <textarea value={vendor.notes} maxLength={500} onChange={(event) => onUpdateVendor(vendor.id, (current) => ({ ...current, notes: event.target.value }))} />
                  </label>
                </div>
              ) : (
                <div className="vendor-status">
                  <span>Availability: {vendor.availability.replaceAll("_", " ")}</span>
                  <span>Booking: {vendor.booking.replaceAll("_", " ")}</span>
                  {vendor.notes && <p>{vendor.notes}</p>}
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
      <p className="vendor-caveat">Checklist categories are ideas to explore. No vendors or availability are confirmed until you record them.</p>
    </section>
  );
}

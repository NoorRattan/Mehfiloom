"use client";

import type { EventBrief } from "@/lib/planner";
import { events, type EventKind } from "@/lib/events";

export default function BriefFields({
  brief,
  onChange,
  kind,
  compact = false,
}: {
  brief: EventBrief;
  onChange: <K extends keyof EventBrief>(key: K, value: EventBrief[K]) => void;
  kind: EventKind;
  compact?: boolean;
}) {
  return (
    <div className={`brief-fields ${compact ? "compact-fields" : ""}`}>
      <label className="field">
        <span>Celebration name</span>
        <input
          name="eventName"
          required
          maxLength={80}
          minLength={2}
          autoComplete="off"
          value={brief.eventName}
          placeholder={
            kind === "wedding"
              ? "Our wedding day"
              : kind === "birthday"
                ? "A birthday to remember"
                : "Our neighbourhood gathering"
          }
          onChange={(e) => onChange("eventName", e.target.value)}
        />
      </label>
      <div className="field-pair">
        <label className="field">
          <span>City or location</span>
          <input
            name="location"
            required
            minLength={2}
            maxLength={100}
            autoComplete="address-level2"
            placeholder="Where’s the celebration?"
            value={brief.location}
            onChange={(e) => onChange("location", e.target.value)}
          />
        </label>
        <label className="field">
          <span>
            Date <small>optional</small>
          </span>
          <input
            name="eventDate"
            type="date"
            value={brief.eventDate}
            onChange={(e) => onChange("eventDate", e.target.value)}
          />
        </label>
      </div>
      <div className="field-pair">
        <label className="field">
          <span>Guest estimate</span>
          <input
            name="guestCount"
            type="number"
            required
            min={1}
            max={10000}
            value={brief.guestCount || ""}
            onChange={(e) => onChange("guestCount", Number(e.target.value))}
          />
        </label>
        <div className="field" role="group" aria-label="Budget">
          <span>Budget</span>
          <div className="money-field">
            <select
              aria-label="Budget currency"
              value={brief.currency}
              onChange={(e) => onChange("currency", e.target.value)}
            >
              <option value="INR">₹ INR</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
              <option value="GBP">£ GBP</option>
            </select>
            <input
              aria-label="Budget amount"
              name="budgetAmount"
              maxLength={24}
              inputMode="decimal"
              pattern="[0-9]+([.][0-9]{1,2})?"
              required
              value={brief.budgetAmount}
              onChange={(e) => onChange("budgetAmount", e.target.value)}
            />
          </div>
        </div>
      </div>
      <label className="field">
        <span>The feeling you’re going for</span>
        <textarea
          name="style"
          rows={compact ? 2 : 3}
          maxLength={500}
          value={brief.style}
          placeholder={events[kind].styles.join(" · ")}
          onChange={(e) => onChange("style", e.target.value)}
        />
      </label>
      <div className="mood-chips" aria-label="Style suggestions">
        {events[kind].styles.map((style) => (
          <button
            key={style}
            type="button"
            className={brief.style === style ? "chosen" : ""}
            aria-pressed={brief.style === style}
            onClick={() => onChange("style", style)}
          >
            {style}
          </button>
        ))}
      </div>
      <label className="field">
        <span>
          Must-haves & things to consider <small>optional</small>
        </span>
        <textarea
          name="mustHaves"
          rows={2}
          maxLength={700}
          value={brief.mustHaves}
          placeholder={
            kind === "community"
              ? "Volunteer roles, access needs, a weather backup…"
              : "Food preferences, access needs, little details you love…"
          }
          onChange={(e) => onChange("mustHaves", e.target.value)}
        />
      </label>
    </div>
  );
}

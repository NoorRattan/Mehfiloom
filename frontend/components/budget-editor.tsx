"use client";

import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import {
  CATEGORY_LABELS,
  currencyDigits,
  parseBudgetMinor,
  type PlanResult,
} from "@/lib/planner";
import { money } from "@/lib/events";

export default function BudgetEditor({
  result,
  onSave,
  onCancel,
}: {
  result: PlanResult;
  onSave: (result: PlanResult) => void;
  onCancel: () => void;
}) {
  const digits = currencyDigits(result.currency);
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      result.lines.map((line) => [
        line.category,
        (line.amountMinor / 10 ** digits).toFixed(digits),
      ]),
    ),
  );
  const [error, setError] = useState("");
  let total: number | null = null;
  try {
    total = result.lines.reduce(
      (sum, line) =>
        sum + parseBudgetMinor(amounts[line.category], result.currency, true),
      0,
    );
  } catch {
    /* Incomplete numbers are kept in the editor until submitted. */
  }
  function save(event: FormEvent) {
    event.preventDefault();
    try {
      const lines = result.lines.map((line) => ({
        ...line,
        amountMinor: parseBudgetMinor(
          amounts[line.category],
          result.currency,
          true,
        ),
      }));
      const allocatedMinor = lines.reduce(
        (sum, line) => sum + line.amountMinor,
        0,
      );
      if (allocatedMinor !== result.totalMinor)
        throw new Error(
          `Your allocations need to add up to ${money(result.totalMinor, result.currency)}.`,
        );
      onSave({ ...result, lines, allocatedMinor });
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Check your allocation amounts.",
      );
    }
  }
  return (
    <form className="budget-editor" onSubmit={save}>
      <p className="small-note">
        Move your budget between categories. The total stays within your
        planning cap.
      </p>
      {result.lines.map((line) => (
        <label key={line.category} className="budget-edit-row">
          <span>{CATEGORY_LABELS[line.category]}</span>
          <div>
            <span>{result.currency}</span>
            <input
              aria-label={`${CATEGORY_LABELS[line.category]} allocation`}
              inputMode="decimal"
              maxLength={24}
              required
              value={amounts[line.category]}
              onChange={(event) =>
                setAmounts((current) => ({
                  ...current,
                  [line.category]: event.target.value,
                }))
              }
            />
          </div>
        </label>
      ))}
      <p className="budget-editor-balance" role="status">
        {total === null
          ? "Check your amounts"
          : total === result.totalMinor
            ? "Every little bit accounted for."
            : `${money(Math.abs(result.totalMinor - total), result.currency)} ${total > result.totalMinor ? "over your cap" : "left to allocate"}`}
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="budget-editor-actions">
        <button className="button button-event" type="submit">
          <Check size={14} /> Save allocation
        </button>
        <button className="text-link" type="button" onClick={onCancel}>
          Keep the current allocation
        </button>
      </div>
    </form>
  );
}

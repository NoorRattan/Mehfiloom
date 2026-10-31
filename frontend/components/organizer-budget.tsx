import { useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Wallet } from "lucide-react";
import type { PlanResult } from "@/lib/planner";
import { money } from "@/lib/events";
import { Flower } from "./chrome";
import BudgetEditor from "./budget-editor";
import { BudgetView } from "./plan-result";

export default function OrganizerBudget({
  result,
  source,
  onRecalculate,
  onSave,
}: {
  result: PlanResult | null;
  source: "starter" | "ai" | null;
  onRecalculate: () => boolean;
  onSave: (result: PlanResult, expected: PlanResult) => boolean;
}) {
  const [editing, setEditing] = useState<PlanResult | null>(null);
  const panel = useRef<HTMLElement>(null);
  function closeEditor() {
    setEditing(null);
    panel.current?.focus();
  }
  function recalculate() {
    if (onRecalculate()) closeEditor();
  }
  return (
    <section
      className="workspace-panel"
      ref={panel}
      tabIndex={-1}
      aria-label="Budget planning"
    >
      <div className="panel-title">
        <div>
          <span className="eyebrow">MAKE ROOM FOR WHAT MATTERS.</span>
          <h3>Your budget, thoughtfully divided.</h3>
        </div>
        <Wallet size={20} />
      </div>
      {result ? (
        <>
          <p className="small-note">
            {source === "ai"
              ? "Your tailored planning allocation"
              : "Your starter allocation"}{" "}
            · {money(result.totalMinor, result.currency)}
          </p>
          {editing ? (
            <BudgetEditor
              result={editing}
              onCancel={closeEditor}
              onSave={(next) => {
                if (onSave(next, editing)) closeEditor();
              }}
            />
          ) : (
            <>
              <BudgetView result={result} />
              <button className="text-link" onClick={() => setEditing(result)}>
                Adjust your allocations <ArrowUpRight size={14} />
              </button>
            </>
          )}
          <button className="text-link" onClick={recalculate}>
            Recalculate using your current budget <ArrowRight size={15} />
          </button>
        </>
      ) : (
        <div className="budget-empty">
          <Flower />
          <h4>A little clarity goes a long way.</h4>
          <p>
            Create an editable starting point from your budget,
            <br />
            or ask your assistant for something more personal.
          </p>
          <button className="button button-event" onClick={recalculate}>
            Create a starter budget <ArrowUpRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
}

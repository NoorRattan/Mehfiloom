"use client";

import { ArrowUpRight, Lightbulb } from "lucide-react";
import Link from "next/link";
import { CATEGORY_LABELS, type PlanResult } from "@/lib/planner";
import { money, type EventKind } from "@/lib/events";

export function BudgetView({ result }: { result: PlanResult }) {
  return (
    <div className="budget-view">
      <div className="allocation-bar" aria-hidden="true">
        {result.lines.map((line, index) => (
          <span
            key={line.category}
            style={{
              width: `${(line.amountMinor / result.totalMinor) * 100}%`,
              backgroundColor: `var(--chart-${index % 8})`,
            }}
            title={`${CATEGORY_LABELS[line.category]}: ${money(line.amountMinor, result.currency)}`}
          />
        ))}
      </div>
      <div
        className="budget-table"
        role="table"
        aria-label="Budget allocations"
      >
        <div className="budget-table-head" role="row">
          <span role="columnheader">THE DETAILS</span>
          <span role="columnheader">SHARE</span>
          <span role="columnheader">PLANNED AMOUNT</span>
        </div>
        {result.lines.map((line, index) => (
          <div className="budget-row" key={line.category} role="row">
            <div role="cell">
              <span
                className="budget-dot"
                style={{ background: `var(--chart-${index % 8})` }}
              />
              <div>
                <strong>{CATEGORY_LABELS[line.category]}</strong>
                <p>{line.rationale}</p>
              </div>
            </div>
            <span role="cell">
              {Math.round((line.amountMinor / result.totalMinor) * 100)}%
            </span>
            <strong role="cell">
              {money(line.amountMinor, result.currency)}
            </strong>
          </div>
        ))}
        <div className="budget-table-total" role="row">
          <strong role="cell" aria-colspan={2}>
            Total planning budget
          </strong>
          <strong role="cell">
            {money(result.totalMinor, result.currency)}
          </strong>
        </div>
      </div>
      <p className="small-note">
        These are planning allocations. Confirm actual prices with your vendors.
      </p>
    </div>
  );
}

export function PlanResultView({
  result,
  kind,
}: {
  result: PlanResult;
  kind: EventKind;
}) {
  return (
    <section className="generated-plan" aria-label="Your tailored plan">
      <div className="generated-heading">
        <p className="eyebrow">A STARTING POINT, MADE FOR YOU</p>
        <h2>{result.proposal.conceptTitle}</h2>
        <p>{result.proposal.overview}</p>
        <span className="theme-tag">{result.proposal.theme}</span>
      </div>
      <div className="result-section">
        <div className="panel-title">
          <h3>A little budget clarity.</h3>
          <span>{money(result.totalMinor, result.currency)}</span>
        </div>
        <BudgetView result={result} />
      </div>
      <div className="result-section">
        <div className="panel-title">
          <h3>One step at a time.</h3>
          <span>YOUR TIMELINE</span>
        </div>
        <ol className="result-timeline">
          {result.proposal.timeline.map((item, i) => (
            <li key={`${item.task}-${i}`}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h4>{item.task}</h4>
                <p>{item.timing}</p>
              </div>
              <span className={`priority priority-${item.priority}`}>
                {item.priority}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="result-section">
        <div className="panel-title">
          <h3>The personal touches.</h3>
          <Lightbulb size={18} />
        </div>
        <div className="result-ideas">
          {result.proposal.ideas.map((idea) => (
            <article key={idea.title}>
              <h4>{idea.title}</h4>
              <p>{idea.whyItFits}</p>
              <span>{idea.costNote}</span>
            </article>
          ))}
        </div>
      </div>
      <div className="result-section">
        <div className="panel-title">
          <h3>Good questions to ask.</h3>
        </div>
        {result.proposal.vendorChecklist.map((group) => (
          <details className="vendor-details" key={group.category}>
            <summary>
              {group.category}
              <span>+</span>
            </summary>
            <ul>
              {group.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </details>
        ))}
      </div>
      <div className="result-open-notes">
        <div>
          <h4>A few things to decide</h4>
          <ul>
            {result.proposal.openQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Assumptions to check</h4>
          <ul>
            {result.proposal.assumptions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      </div>
      <Link href={`/${kind}/organize`} className="button button-event">
        It’s saved. Open your organizer <ArrowUpRight size={16} />
      </Link>
    </section>
  );
}

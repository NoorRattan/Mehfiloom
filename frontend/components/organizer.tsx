"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Download,
  Plus,
  Sparkles,
  CalendarDays,
  Users,
  Wallet,
  ArrowRight,
  ListChecks,
} from "lucide-react";
import {
  buildPlanResult,
  getEventTemplateProposal,
  parseBudgetMinor,
  type EventBrief,
} from "@/lib/planner";
import { events, money, type EventKind } from "@/lib/events";
import { useWorkspace } from "@/lib/workspace-store";
import BriefFields from "./brief-fields";
import { BudgetView } from "./plan-result";
import { Flower } from "./chrome";
import BudgetEditor from "./budget-editor";

type Tab = "overview" | "budget" | "checklist" | "vendors";
export default function Organizer({ kind }: { kind: EventKind }) {
  const { state, update } = useWorkspace(kind);
  const [tab, setTab] = useState<Tab>("overview");
  const [task, setTask] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [editingBudget, setEditingBudget] = useState(false);
  const data = events[kind];
  const defaultTasks = data.tasks.map((title) => ({
    title: String(title),
    timing: "Your next steps",
  }));
  const tailoredTasks =
    state.resultSource === "ai"
      ? (state.result?.proposal.timeline
          .map((item) => ({ title: item.task, timing: item.timing }))
          .filter(
            (item) => !defaultTasks.some((task) => task.title === item.title),
          ) ?? [])
      : [];
  const tasks = [
    ...new Map(
      [
        ...defaultTasks,
        ...tailoredTasks,
        ...state.customTasks.map((title) => ({
          title,
          timing: "Added by you",
        })),
      ].map((item) => [item.title, item]),
    ).values(),
  ];
  const completed = tasks.filter((item) =>
    state.checked.includes(item.title),
  ).length;
  const completion = Math.round((completed / tasks.length) * 100);
  let budgetLabel = "Set your budget";
  try {
    budgetLabel = money(
      parseBudgetMinor(state.brief.budgetAmount, state.brief.currency),
      state.brief.currency,
    );
  } catch {
    /* The budget field remains editable while incomplete. */
  }
  function change<K extends keyof EventBrief>(key: K, value: EventBrief[K]) {
    update((current) => ({
      ...current,
      brief: { ...current.brief, [key]: value },
    }));
  }
  function toggle(title: string) {
    update((current) => ({
      ...current,
      checked: current.checked.includes(title)
        ? current.checked.filter((item) => item !== title)
        : [...current.checked, title],
    }));
  }
  function createBudget() {
    setError("");
    try {
      const total = parseBudgetMinor(
        state.brief.budgetAmount,
        state.brief.currency,
      );
      update((current) => ({
        ...current,
        result: buildPlanResult(
          current.result?.proposal ?? getEventTemplateProposal(kind),
          current.brief.currency,
          total,
        ),
        resultSource: current.resultSource ?? "starter",
      }));
      setNotice("Your budget allocation is ready and saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please check your budget.");
    }
  }
  function addTask(event: FormEvent) {
    event.preventDefault();
    const title = task.trim();
    if (!title) return;
    if (tasks.some((item) => item.title === title)) {
      setError("That task is already on your list.");
      return;
    }
    if (state.customTasks.length >= 50) {
      setError("Your checklist has reached 50 custom tasks.");
      return;
    }
    update((current) => ({
      ...current,
      customTasks: [...current.customTasks, title],
    }));
    setTask("");
    setError("");
  }
  function exportPlan() {
    const lines = [
      state.brief.eventName || `My ${data.singular}`,
      `Location: ${state.brief.location || "To be decided"}`,
      `Date: ${state.brief.eventDate || "To be decided"}`,
      `Guests: ${state.brief.guestCount}`,
      `Budget: ${budgetLabel}`,
      "",
      "CHECKLIST",
      ...tasks.map(
        (item) =>
          `${state.checked.includes(item.title) ? "[x]" : "[ ]"} ${item.title} — ${item.timing}`,
      ),
      "",
      "VENDOR NOTES",
      ...Object.entries(state.vendorNotes).map(
        ([category, notes]) => `${category}: ${notes}`,
      ),
    ];
    if (state.result)
      lines.push(
        "",
        "BUDGET ALLOCATION",
        ...state.result.lines.map(
          (line) =>
            `${line.category}: ${money(line.amountMinor, state.result!.currency)}`,
        ),
        "",
        "PERSONAL IDEAS",
        ...state.result.proposal.ideas.map(
          (idea) => `${idea.title}: ${idea.whyItFits}`,
        ),
      );
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `mehfiloom-${kind}-plan.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setNotice("Your plan has been exported.");
  }
  const vendors =
    state.result?.proposal.vendorChecklist ??
    data.vendors.map((category) => ({
      category,
      questions: [
        "What is included in your quote?",
        "Is our preferred date available?",
        "What are the deposit and cancellation terms?",
      ],
    }));
  return (
    <main id="main" className={`workspace-main workspace-${kind} wrap`}>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">
            YOUR {kind === "community" ? "GATHERING" : kind.toUpperCase()}{" "}
            ORGANIZER
          </p>
          <h1>{data.organizerTitle}</h1>
          <p>Big picture. Little details. All coming together.</p>
        </div>
        <div className="workspace-heading-actions">
          <a href="#event-details" className="text-link">
            Edit your details <ArrowUpRight size={14} />
          </a>
          <button className="button button-outline" onClick={exportPlan}>
            <Download size={15} /> Export plan
          </button>
        </div>
      </div>
      <div className="workspace-grid">
        <aside id="event-details" className="workspace-sidebar">
          <div className="sidebar-photo">
            <Image
              src={data.image}
              alt={`Inspiration for your ${data.singular}`}
              fill
              sizes="(max-width: 760px) 90vw, 300px"
            />
            <span>{data.subtitle}</span>
          </div>
          <div className="sidebar-details">
            <div className="panel-title">
              <h2>The little details</h2>
              <Flower />
            </div>
            <BriefFields
              brief={state.brief}
              onChange={change}
              kind={kind}
              compact
            />
            <p className="save-note">
              <span /> Stored on this browser · no account needed
            </p>
          </div>
        </aside>
        <div className="workspace-content">
          <div className="workspace-welcome">
            <div>
              <span className="eyebrow">
                A LITTLE MORE REAL WITH EVERY STEP.
              </span>
              <h2>
                {state.brief.eventName ||
                  `Your ${data.singular}, taking shape.`}
              </h2>
              <p>
                <CalendarDays size={13} />{" "}
                {state.brief.eventDate
                  ? new Intl.DateTimeFormat("en", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(`${state.brief.eventDate}T12:00:00Z`))
                  : "A date to look forward to"}
                <span>·</span>
                {state.brief.location || "Somewhere special"}
              </p>
            </div>
            <Flower />
          </div>
          <div className="workspace-stats">
            <div>
              <Wallet size={16} />
              <span>YOUR BUDGET</span>
              <strong>{budgetLabel}</strong>
            </div>
            <div>
              <Users size={16} />
              <span>PEOPLE TO CELEBRATE WITH</span>
              <strong>
                {state.brief.guestCount || "—"}
                <small>guests</small>
              </strong>
            </div>
            <div>
              <ListChecks size={16} />
              <span>LITTLE THINGS, DONE</span>
              <strong>
                {completed}
                <small>of {tasks.length} tasks</small>
              </strong>
            </div>
          </div>
          <nav className="workspace-tabs" aria-label="Organizer sections">
            {(["overview", "budget", "checklist", "vendors"] as const).map(
              (item) => (
                <button
                  key={item}
                  className={tab === item ? "selected" : ""}
                  onClick={() => setTab(item)}
                  aria-pressed={tab === item}
                >
                  {item === "overview"
                    ? "The overview"
                    : item === "budget"
                      ? "Your budget"
                      : item === "checklist"
                        ? "The checklist"
                        : "Your vendors"}
                </button>
              ),
            )}
          </nav>
          {notice && (
            <p className="success-message" role="status">
              <Check size={15} />
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                ×
              </button>
            </p>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          {(tab === "overview" || tab === "checklist") && (
            <section className="workspace-panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">ONE THING AT A TIME.</span>
                  <h3>
                    {tab === "overview"
                      ? "Your next little steps."
                      : "A little list. A lot of progress."}
                  </h3>
                </div>
                <span className="completion-label">{completion}% together</span>
              </div>
              <div
                className="completion-track"
                role="progressbar"
                aria-label="Checklist completion"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={completion}
              >
                <span style={{ width: `${completion}%` }} />
              </div>
              <div className="task-list">
                {(tab === "overview" ? tasks.slice(0, 4) : tasks).map(
                  (item) => (
                    <label
                      key={item.title}
                      className={`task-row ${state.checked.includes(item.title) ? "done" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={state.checked.includes(item.title)}
                        onChange={() => toggle(item.title)}
                      />
                      <span className="task-checkbox">
                        <Check size={12} />
                      </span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.timing}</small>
                      </span>
                      <ArrowUpRight size={15} />
                    </label>
                  ),
                )}
              </div>
              {tab === "overview" ? (
                <button
                  className="text-link"
                  onClick={() => setTab("checklist")}
                >
                  See the whole checklist <ArrowRight size={15} />
                </button>
              ) : (
                <form onSubmit={addTask} className="add-task">
                  <input
                    maxLength={120}
                    required
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                    placeholder="One more thing to remember…"
                    aria-label="New checklist task"
                  />
                  <button
                    type="submit"
                    className="icon-button"
                    aria-label="Add task"
                  >
                    <Plus size={18} />
                  </button>
                </form>
              )}
            </section>
          )}
          {tab === "budget" && (
            <section className="workspace-panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">MAKE ROOM FOR WHAT MATTERS.</span>
                  <h3>Your budget, thoughtfully divided.</h3>
                </div>
                <Wallet size={20} />
              </div>
              {state.result ? (
                <>
                  <p className="small-note">
                    {state.resultSource === "ai"
                      ? "Your tailored planning allocation"
                      : "Your starter allocation"}{" "}
                    · {money(state.result.totalMinor, state.result.currency)}
                  </p>
                  {editingBudget ? (
                    <BudgetEditor
                      result={state.result}
                      onCancel={() => setEditingBudget(false)}
                      onSave={(result) => {
                        update((current) => ({ ...current, result }));
                        setEditingBudget(false);
                        setNotice("Your updated budget allocation is saved.");
                      }}
                    />
                  ) : (
                    <>
                      <BudgetView result={state.result} />
                      <button
                        className="text-link"
                        onClick={() => setEditingBudget(true)}
                      >
                        Adjust your allocations <ArrowUpRight size={14} />
                      </button>
                    </>
                  )}
                  <button className="text-link" onClick={createBudget}>
                    Recalculate using your current budget{" "}
                    <ArrowRight size={15} />
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
                  <button
                    className="button button-event"
                    onClick={createBudget}
                  >
                    Create a starter budget <ArrowUpRight size={16} />
                  </button>
                </div>
              )}
            </section>
          )}
          {tab === "vendors" && (
            <section className="workspace-panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">
                    GOOD PEOPLE TO HAVE ON YOUR SIDE.
                  </span>
                  <h3>Your vendor conversations.</h3>
                </div>
              </div>
              <p className="panel-description">
                Keep your questions and notes together as you find your people.
              </p>
              {vendors.map((group) => (
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
                  <label className="field">
                    <span>Your notes</span>
                    <textarea
                      maxLength={1000}
                      rows={3}
                      value={state.vendorNotes[group.category] ?? ""}
                      onChange={(e) =>
                        update((current) => ({
                          ...current,
                          vendorNotes: {
                            ...current.vendorNotes,
                            [group.category]: e.target.value,
                          },
                        }))
                      }
                      placeholder="Contact details, quotes, availability, next steps…"
                    />
                  </label>
                </details>
              ))}
            </section>
          )}
          {tab === "overview" && (
            <div className="workspace-ai-note">
              <span className="ai-note-icon">
                <Sparkles size={22} />
              </span>
              <div>
                <p className="eyebrow">A LITTLE HELP GOES A LONG WAY.</p>
                <h3>What if the planning felt lighter?</h3>
                <p>
                  Your own {data.singular} assistant is ready to connect the
                  dots.
                </p>
                <Link href={`/${kind}/assist`} className="text-link">
                  Let’s dream it up <ArrowUpRight size={15} />
                </Link>
              </div>
              <Flower />
            </div>
          )}
          <p className="workspace-bottom-note">
            Your draft stays in this browser. Export a copy to keep it with you.
          </p>
        </div>
      </div>
    </main>
  );
}

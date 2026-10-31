"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Download,
  Sparkles,
  CalendarDays,
  Users,
  Wallet,
  ListChecks,
} from "lucide-react";
import { events, type EventKind } from "@/lib/events";
import { useOrganizer } from "@/lib/use-organizer";
import { organizerDateLabel } from "@/lib/organizer-model";
import BriefFields from "./brief-fields";
import { Flower } from "./chrome";
import OrganizerTabs, { type OrganizerTab } from "./organizer-tabs";
import WorkspaceStorageStatus from "./workspace-storage-status";
import OrganizerChecklist from "./organizer-checklist";
import OrganizerBudget from "./organizer-budget";
import OrganizerVendors from "./organizer-vendors";

export default function Organizer({ kind }: { kind: EventKind }) {
  const model = useOrganizer(kind);
  const {
    state,
    storageStatus,
    tasks,
    completed,
    completion,
    budgetLabel,
    notice,
    error,
  } = model;
  const [tab, setTab] = useState<OrganizerTab>("overview");
  const panelRef = useRef<HTMLDivElement>(null);
  const data = events[kind];
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
          <button className="button button-outline" onClick={model.exportPlan}>
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
              onChange={model.change}
              kind={kind}
              compact
            />
            <WorkspaceStorageStatus status={storageStatus} kind={kind} />
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
                {organizerDateLabel(state.brief.eventDate)}
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
          <OrganizerTabs kind={kind} selected={tab} onSelect={setTab} />
          {notice && (
            <p className="success-message" role="status">
              <Check size={15} />
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={model.dismissNotice}
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
          <div
            id={`${kind}-organizer-panel`}
            role="tabpanel"
            aria-labelledby={`${kind}-tab-${tab}`}
            tabIndex={0}
            ref={panelRef}
          >
            {(tab === "overview" || tab === "checklist") && (
              <OrganizerChecklist
                tasks={tasks}
                checked={state.checked}
                completion={completion}
                overview={tab === "overview"}
                onToggle={model.toggleTask}
                onAddTask={model.addTask}
                onShowChecklist={() => {
                  setTab("checklist");
                  requestAnimationFrame(() => panelRef.current?.focus());
                }}
              />
            )}
            {tab === "budget" && (
              <OrganizerBudget
                result={state.result}
                source={state.resultSource}
                onRecalculate={model.recalculateBudget}
                onSave={model.saveBudget}
              />
            )}
            {tab === "vendors" && (
              <OrganizerVendors
                vendors={model.vendors}
                notes={state.vendorNotes}
                onChangeNote={model.changeVendorNote}
              />
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
          </div>
          <p className="workspace-bottom-note">
            Export a copy of your draft to keep it with you.
          </p>
        </div>
      </div>
    </main>
  );
}

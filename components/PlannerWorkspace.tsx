"use client";

import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Flower2,
  Plus,
  Sparkles,
  Trash2,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  BUDGET_CATEGORIES,
  CATEGORY_LABELS,
  EXAMPLE_BRIEF,
  buildPlanResult,
  currencyDigits,
  exampleBriefForEvent,
  eventBriefSchema,
  formatMoney,
  getEventTemplateProposal,
  parseBudgetMinor,
  type EventBrief,
  type EventType,
  type PlanResult,
  type PlannerProposal,
} from "@/lib/planner";
import {
  MAX_SAVED_PLANS,
  MAX_PLAN_DOCUMENT_BYTES,
  addCostPayment,
  calculateBudgetHealth,
  createSavedPlan,
  createWorkspace,
  evidenceAfterAmountEntry,
  expectedGuestsForCostItem,
  forecastCostItem,
  makeId,
  parseCostExclusions,
  parsePlanDocument,
  quoteValidityStatus,
  reidentifyPlan,
  removeCostPayment,
  resolveTaskDate,
  savedPlanSchema,
  serializePlanDocument,
  taskScheduleConflicts,
  type CostItem,
  type CostAdjustment,
  type SavedPlan,
  type TaskRecord,
  type VendorRecord,
  type Workspace,
} from "@/lib/plan-store";
import {
  clearWorkspaceStorage,
  loadWorkspaceFromStorage,
  saveWorkspaceToStorage,
} from "@/lib/plan-storage";
import { dateInTimeZone, resolveZonedDateTime } from "@/lib/schedule";
import { acceptPlanRevision, diffPlanRevision, restorePreviousPlanRevision, revisionGenerationRequest, type PendingPlanRevision } from "@/lib/plan-revisions";
import { PaymentHistoryPanel, type PaymentDraft } from "./PaymentHistoryPanel";
import { CostAdjustmentsEditor, type CostAdjustmentDraft } from "./CostAdjustmentsEditor";
import { PlanVerificationNotice } from "./PlanVerificationNotice";
import { RevisionReviewPanel } from "./RevisionReviewPanel";
import { BudgetAllocationPanel, VendorChecklistSection } from "./PlanSummarySections";
import { PlanFileActions } from "./PlanFileActions";
import { BrandMark } from "./BrandMark";
import { TaskTimelineSection } from "./TaskTimelineSection";
import { EventBriefForm } from "./EventBriefForm";

const EVENT_LABELS: Record<EventType, string> = {
  wedding: "Wedding",
  birthday: "Birthday",
  community: "Community event",
};

function makeSeedPlan(eventType: EventType, id = "example-plan") {
  const brief = exampleBriefForEvent(eventType, EXAMPLE_BRIEF);
  return createSavedPlan(brief, brief, getEventTemplateProposal(eventType), id, "2026-10-20T00:00:00.000Z");
}

function emptyCostDraft() {
  return { label: "", category: "venue" as (typeof BUDGET_CATEGORIES)[number], sessionId: null as string | null, pricingModel: "fixed" as CostItem["pricingModel"], amount: "", maxAmount: "", evidence: "estimate" as CostItem["evidence"], mandatory: true };
}

function amountInput(amountMinor: number | null, currency: string): string {
  if (amountMinor === null) return "";
  return (amountMinor / 10 ** currencyDigits(currency)).toFixed(currencyDigits(currency)).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function costEvidenceSummary(cost: CostItem, currency: string, expectedGuests: number): string {
  if (cost.amountMinor === null) return `No price yet${cost.mandatory ? " · mandatory" : " · optional"}`;
  const forecast = forecastCostItem(cost, expectedGuests);
  const rateLabel = cost.pricingModel === "per_guest" ? " per guest" : "";
  const rateRange = cost.amountMaxMinor !== null && cost.amountMaxMinor !== cost.amountMinor
    ? `${formatMoney(cost.amountMinor, currency)}–${formatMoney(cost.amountMaxMinor, currency)}${rateLabel}`
    : `${formatMoney(cost.amountMinor, currency)}${rateLabel}`;
  const projected = forecast.lowerMinor === forecast.upperMinor
    ? formatMoney(forecast.lowerMinor ?? 0, currency)
    : `${formatMoney(forecast.lowerMinor ?? 0, currency)}–${formatMoney(forecast.upperMinor ?? 0, currency)}`;
  return `${cost.evidence} · ${rateRange} · forecast ${projected}${cost.pricingModel === "per_guest" ? ` for ${forecast.units} guests` : ""}${cost.mandatory ? " · mandatory" : " · optional"}`;
}

function quoteValidityMessage(cost: CostItem, today: string): string | null {
  const status = quoteValidityStatus(cost, today);
  if (status === "expired") return `Expired on ${cost.validUntil}; reconfirm before relying on this price.`;
  if (status === "unknown") return "Validity date unknown; reconfirm before relying on this price.";
  if (status === "current") return `Valid through ${cost.validUntil}.`;
  return null;
}

function sessionScopeLabel(sessions: EventBrief["sessions"], sessionId: string | null): string {
  if (sessionId === null) return "Shared across the event";
  return sessions.find((session) => session.id === sessionId)?.name ?? "Unknown session";
}

function briefIssueTarget(path: PropertyKey[], sessions: EventBrief["sessions"]): string {
  const [field, index, detail] = path;
  if (field === "sessions" && typeof index === "number") {
    const sessionId = sessions[index]?.id;
    if (sessionId) {
      const suffix = detail === "date" ? "date" : detail === "startTime" ? "time" : detail === "guestCount" ? "guests" : "name";
      return `session-${sessionId}-${suffix}`;
    }
    return sessions[0] ? `session-${sessions[0].id}-name` : "session-builder-title";
  }

  const targets: Record<string, string> = {
    eventName: "event-name",
    location: "event-location",
    eventDate: "event-date",
    timeZone: "event-timezone",
    eventTime: "event-time",
    eventTimeOccurrence: "event-time",
    guestCount: "guest-count",
    sessions: "session-builder-title",
    budgetAmount: "budget-amount",
    currency: "event-currency",
    style: "event-style",
    mustHaves: "event-must-haves",
  };
  return typeof field === "string" ? targets[field] ?? "event-name" : "event-name";
}

function moneyRange(lowerMinor: number, upperMinor: number, currency: string): string {
  return lowerMinor === upperMinor
    ? formatMoney(lowerMinor, currency)
    : `${formatMoney(lowerMinor, currency)}–${formatMoney(upperMinor, currency)}`;
}

function formatZonedInstant(instant: string | null, timeZone: string | null): string | null {
  if (!instant || !timeZone) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(instant));
  } catch {
    return null;
  }
}

function downloadJson(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const EVENT_WELCOME: Record<EventType, { headline: string; copy: string; eyebrow: string }> = {
  wedding: {
    eyebrow: "YOUR WEDDING, YOUR WAY",
    headline: "A thoughtful plan for a day that feels like you.",
    copy: "Bring your date, guest estimate, budget and must-haves together. Mehfiloom shapes them into a flexible timeline, cost plan, vendor questions and personal ideas. Start with what you know; leave the rest open.",
  },
  birthday: {
    eyebrow: "MAKE THEIR DAY FEEL LIKE THEIRS",
    headline: "From first idea to a birthday worth remembering.",
    copy: "Choose the kind of celebration first, then organize the people, place, budget, food and activity flow around it. Whether it is for a child, an adult or everyone together, the plan should fit your guest of honor.",
  },
  community: {
    eyebrow: "BRING YOUR PEOPLE TOGETHER",
    headline: "A clear plan for a gathering with a purpose.",
    copy: "Keep the goal, audience, venue, costs, volunteers and day-of details in view. Start small, add the checks that fit your event, and keep local venue or permit requirements on your own confirmation list.",
  },
};

export default function PlannerWorkspace({ initialEventType }: { initialEventType: EventType }) {
  const [workspace, setWorkspace] = useState<Workspace>(() => createWorkspace(makeSeedPlan(initialEventType)));
  const [storageReady, setStorageReady] = useState(false);
  const [storageLoadFailed, setStorageLoadFailed] = useState(false);
  const [storageLoadAttempt, setStorageLoadAttempt] = useState(0);
  const [todayDate, setTodayDate] = useState("");
  const [quoteTodayDate, setQuoteTodayDate] = useState("");
  const [storageStatus, setStorageStatus] = useState("Loading plans on this device…");
  const [storageError, setStorageError] = useState("");
  const [error, setError] = useState("");
  const [errorTargetId, setErrorTargetId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationAnnouncement, setGenerationAnnouncement] = useState("");
  const [editing, setEditing] = useState(false);
  const [costDraft, setCostDraft] = useState(emptyCostDraft);
  const [costMessage, setCostMessage] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [revisionRequest, setRevisionRequest] = useState("");
  const [pendingRevision, setPendingRevision] = useState<PendingPlanRevision | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, PaymentDraft>>({});
  const planHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusPlanHeadingAfterRevision = useRef(false);

  useEffect(() => {
    if (!error || !errorTargetId) return;
    document.getElementById(errorTargetId)?.focus();
  }, [error, errorTargetId]);

  useEffect(() => {
    if (!focusPlanHeadingAfterRevision.current) return;
    focusPlanHeadingAfterRevision.current = false;
    planHeadingRef.current?.focus();
  }, [workspace, pendingRevision]);

  useEffect(() => {
    let active = true;
    async function loadFromDevice() {
      await Promise.resolve();
      let timeZone: string | null = null;
      try {
        const loaded = loadWorkspaceFromStorage(window.localStorage);
        if (!active) return;
        if (loaded) {
          const savedActivePlan = loaded.plans.find((item) => item.id === loaded.activePlanId);
          if (savedActivePlan?.draftBrief.eventType === initialEventType) {
            setWorkspace(loaded);
            timeZone = savedActivePlan.draftBrief.timeZone;
          } else {
            const matchingPlan = loaded.plans.find((item) => item.draftBrief.eventType === initialEventType);
            if (matchingPlan) {
              setWorkspace({ ...loaded, activePlanId: matchingPlan.id });
              timeZone = matchingPlan.draftBrief.timeZone;
            } else if (loaded.plans.length < MAX_SAVED_PLANS) {
              const nextPlan = makeSeedPlan(initialEventType, makeId());
              setWorkspace({ ...loaded, activePlanId: nextPlan.id, plans: [...loaded.plans, nextPlan] });
              timeZone = nextPlan.draftBrief.timeZone;
            } else {
              setWorkspace(loaded);
              timeZone = savedActivePlan?.draftBrief.timeZone ?? null;
              setImportMessage(`Your device already has ${MAX_SAVED_PLANS} plans. Choose an existing ${EVENT_LABELS[initialEventType].toLowerCase()} plan or export and remove one before creating another.`);
            }
          }
          setStorageStatus("Checking local plans…");
        } else {
          setStorageStatus("New local workspace");
        }
      } catch (loadError) {
        if (!active) return;
        setStorageLoadFailed(true);
        setStorageError(loadError instanceof Error ? loadError.message : "Could not read this device’s saved plans.");
        setStorageStatus("Saved plans need attention");
      } finally {
        if (active) {
          setTodayDate(dateInTimeZone(new Date(), timeZone) ?? "");
          const localNow = new Date();
          setQuoteTodayDate(`${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, "0")}-${String(localNow.getDate()).padStart(2, "0")}`);
          setStorageReady(true);
        }
      }
    }
    void loadFromDevice();
    return () => { active = false; };
  }, [initialEventType, storageLoadAttempt]);

  useEffect(() => {
    if (!storageReady || storageLoadFailed) return;
    let active = true;
    async function saveToDevice() {
      await Promise.resolve();
      if (!active) return;
      setStorageStatus("Saving changes on this device…");
      try {
        saveWorkspaceToStorage(window.localStorage, workspace);
        if (active) {
          setStorageError("");
          setStorageStatus("Saved on this device");
        }
      } catch (saveError) {
        if (active) {
          setStorageError(saveError instanceof Error ? saveError.message : "The browser could not save this workspace.");
          setStorageStatus("Changes are not saved");
        }
      }
    }
    void saveToDevice();
    return () => { active = false; };
  }, [workspace, storageReady, storageLoadFailed]);

  const activePlan = workspace.plans.find((item) => item.id === workspace.activePlanId) ?? workspace.plans[0];
  const brief = activePlan.draftBrief;
  const submittedBrief = activePlan.planBrief;
  const proposal = activePlan.proposal;
  const plan: PlanResult = buildPlanResult(proposal, activePlan.budget.currency, activePlan.budget.capMinor);
  const briefChanged = JSON.stringify(brief) !== JSON.stringify(submittedBrief);
  const budgetTotal = plan.lines.reduce((sum, item) => sum + item.amountMinor, 0);
  const validatedPlan = savedPlanSchema.safeParse(activePlan);
  const budgetHealth = validatedPlan.success ? calculateBudgetHealth(activePlan) : null;
  const taskById = new Map(activePlan.tasks.map((task) => [task.id, task]));
  const scheduleConflicts = taskScheduleConflicts(activePlan.tasks, brief.eventDate, todayDate, brief.sessions);
  const printScheduleConflicts = taskScheduleConflicts(
    activePlan.tasks,
    submittedBrief.eventDate,
    submittedBrief.timeZone === brief.timeZone ? todayDate : "",
    submittedBrief.sessions,
  );
  const eventTimeResolution = resolveZonedDateTime(brief.eventDate, brief.eventTime, brief.timeZone, brief.eventTimeOccurrence);
  const eventTimeDisplay = formatZonedInstant(eventTimeResolution.instant, brief.timeZone);
  const submittedEventTimeDisplay = formatZonedInstant(
    resolveZonedDateTime(submittedBrief.eventDate, submittedBrief.eventTime, submittedBrief.timeZone, submittedBrief.eventTimeOccurrence).instant,
    submittedBrief.timeZone,
  );
  const sessionTimeResolutions = new Map(brief.sessions.map((session) => [
    session.id,
    resolveZonedDateTime(session.date, session.startTime, brief.timeZone, session.startTimeOccurrence),
  ]));
  const guestsOverExpected = activePlan.guestSummary.confirmed !== null && activePlan.guestSummary.confirmed > activePlan.guestSummary.expected;
  const quoteMinimumsOverExpected = activePlan.budget.items.filter((item) => item.minimumGuestCount !== null && item.minimumGuestCount > expectedGuestsForCostItem(activePlan, item));
  const sessionsOverExpected = activePlan.sessionAttendance.filter((attendance) => {
    const session = activePlan.planBrief.sessions.find((item) => item.id === attendance.sessionId);
    return session && attendance.confirmedGuests !== null && attendance.confirmedGuests > session.guestCount;
  });
  const currency = activePlan.budget.currency;
  const pendingRevisionIsStale = pendingRevision !== null && activePlan !== pendingRevision.basePlan;
  const canRestoreRevision = activePlan.undoRevision !== null
    && activePlan.updatedAt === activePlan.undoRevision.acceptedAt
    && activePlan.revisionNumber === activePlan.undoRevision.revisionNumber;

  function updateWorkspace(update: (current: Workspace) => Workspace) {
    if (!storageLoadFailed) setStorageStatus("Saving changes on this device…");
    setWorkspace((current) => update(current));
  }

  function clearEditorState() {
    setEditing(false);
    setCostDraft(emptyCostDraft());
    setAmountDrafts({});
    setPaymentDrafts({});
    setCostMessage("");
    setError("");
    setErrorTargetId(null);
    setImportMessage("");
    setRevisionRequest("");
    setPendingRevision(null);
    setRevisionFeedback(null);
  }

  function selectPlan(planId: string) {
    const selectedPlan = workspace.plans.find((item) => item.id === planId);
    setTodayDate(dateInTimeZone(new Date(), selectedPlan?.draftBrief.timeZone ?? null) ?? "");
    updateWorkspace((current) => ({ ...current, activePlanId: planId }));
    clearEditorState();
  }

  function updateActivePlan(update: (current: SavedPlan) => SavedPlan) {
    updateWorkspace((current) => ({
      ...current,
      plans: current.plans.map((item) => item.id === current.activePlanId
        ? { ...update(item), updatedAt: new Date(Math.max(Date.now(), Date.parse(item.updatedAt) + 1)).toISOString() }
        : item),
    }));
  }

  function updateBrief<K extends keyof EventBrief>(field: K, value: EventBrief[K]) {
    updateActivePlan((current) => {
      const draftBrief = { ...current.draftBrief, [field]: value } as EventBrief;
      if (field === "timeZone") {
        draftBrief.eventTimeOccurrence = null;
        draftBrief.sessions = draftBrief.sessions.map((session) => ({ ...session, startTimeOccurrence: null }));
      } else if (field === "eventDate" || field === "eventTime") {
        draftBrief.eventTimeOccurrence = null;
      }
      return { ...current, draftBrief };
    });
    if (field === "timeZone") setTodayDate(dateInTimeZone(new Date(), value as EventBrief["timeZone"]) ?? "");
    setError("");
    setErrorTargetId(null);
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setErrorTargetId(null);

    const parsedBrief = eventBriefSchema.safeParse(brief);
    if (!parsedBrief.success) {
      setError(parsedBrief.error.issues[0]?.message ?? "Check the event details and try again.");
      setErrorTargetId(briefIssueTarget(parsedBrief.error.issues[0]?.path ?? [], brief.sessions));
      return;
    }

    try {
      parseBudgetMinor(parsedBrief.data.budgetAmount, parsedBrief.data.currency);
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Check the budget amount.");
      setErrorTargetId("budget-amount");
      return;
    }

    const isRevision = activePlan.origin === "ai";
    const requestedChange = revisionRequest.trim();
    if (isRevision && parsedBrief.data.eventType !== activePlan.planBrief.eventType) {
      setError("A revision keeps the same event type. Create a separate plan to change the celebration type.");
      setErrorTargetId("event-type-options");
      return;
    }
    if (isRevision && parsedBrief.data.currency !== activePlan.budget.currency) {
      setError("A revision keeps the same currency so recorded costs are never reinterpreted. Create a separate plan to change currency.");
      setErrorTargetId("event-currency");
      return;
    }
    if (isRevision && (requestedChange.length < 8 || requestedChange.length > 500)) {
      setError("Describe what changed in at least 8 characters and no more than 500.");
      setErrorTargetId("revision-request");
      return;
    }
    if (!isRevision && activePlan.edited && !window.confirm("Replace the edited proposal and its checklist with a new AI draft? Recorded costs are kept when the currency matches.")) return;

    const targetPlanId = activePlan.id;
    const basePlan = activePlan;
    setPendingRevision(null);
    setRevisionFeedback(null);
    setGenerating(true);
    setGenerationAnnouncement(isRevision ? "Creating a proposed revision. This may take a little while." : "Creating your plan. This may take a little while.");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRevision
          ? revisionGenerationRequest(parsedBrief.data, basePlan.revisionHistory.map((entry) => entry.request), requestedChange)
          : parsedBrief.data),
      });
      const payload = (await response.json()) as { result?: PlanResult; error?: { message?: string } };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error?.message ?? "The plan could not be generated. Your brief is still here.");
      }

      const generatedAt = new Date().toISOString();
      const candidatePlan = createSavedPlan(parsedBrief.data, parsedBrief.data, payload.result.proposal, basePlan.id, generatedAt, "ai");
      if (isRevision) {
        setPendingRevision({
          basePlan,
          candidatePlan,
          request: requestedChange,
          changes: diffPlanRevision(basePlan, candidatePlan),
        });
        setRevisionFeedback({ tone: "success", message: "A separate proposal is ready. Your current plan and recorded work are unchanged." });
        setGenerationAnnouncement("A proposed revision is ready to review.");
        setEditing(false);
        return;
      }

      updateWorkspace((current) => ({
        ...current,
        plans: current.plans.map((item) => {
          if (item.id !== targetPlanId) return item;
          const replacement = createSavedPlan(parsedBrief.data, parsedBrief.data, payload.result!.proposal, item.id, generatedAt, "ai");
          const sameCurrency = item.budget.currency === replacement.budget.currency;
          const oldVendorCategory = new Map(item.vendors.map((vendor) => [vendor.id, vendor.category.toLowerCase()]));
          const vendorIdByCategory = new Map(replacement.vendors.map((vendor) => [vendor.category.toLowerCase(), vendor.id]));
          const retainedCosts = sameCurrency ? item.budget.items
            .filter((cost) => cost.evidence !== "unpriced" || cost.mandatory)
            .map((cost) => {
              const categoryName = cost.vendorId ? oldVendorCategory.get(cost.vendorId) : undefined;
              const vendorId = categoryName ? vendorIdByCategory.get(categoryName) ?? null : null;
              return { ...cost, vendorId };
            }) : [];
          const costsByCategory = new Set(retainedCosts.map((cost) => cost.category));
          const defaultCosts = replacement.budget.items.filter((cost) => !costsByCategory.has(cost.category));
          const tasks = replacement.tasks.map((task) => {
            const previous = item.tasks.find((candidate) => candidate.title === task.title && candidate.sessionId === task.sessionId);
            return previous ? {
              ...task,
              status: previous.status,
              ownerLabel: previous.ownerLabel,
              dueDate: previous.dueDate,
              relativeOffsetDays: previous.relativeOffsetDays,
            } : task;
          });
          const vendors = replacement.vendors.map((vendor) => {
            const previous = item.vendors.find((candidate) => candidate.category.toLowerCase() === vendor.category.toLowerCase());
            return previous ? { ...vendor, ...previous, id: vendor.id, category: vendor.category } : vendor;
          });
          return {
            ...replacement,
            draftBrief: item.draftBrief,
            edited: false,
            tasks,
            vendors,
            budget: {
              ...replacement.budget,
              reviewComplete: false,
              items: [...retainedCosts, ...defaultCosts],
            },
          };
        }),
      }));
      setGenerationAnnouncement("Your plan is ready on the planning canvas.");
      clearEditorState();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The request could not be completed. Please try again.");
      setGenerationAnnouncement("Plan generation did not complete. Review the error message and try again.");
    } finally {
      setGenerating(false);
    }
  }

  function acceptRevision() {
    if (!pendingRevision) return;
    try {
      const revisedPlan = acceptPlanRevision(
        pendingRevision.basePlan,
        activePlan,
        pendingRevision.candidatePlan,
        pendingRevision.request,
      );
      focusPlanHeadingAfterRevision.current = true;
      updateWorkspace((current) => ({
        ...current,
        plans: current.plans.map((item) => item.id === revisedPlan.id ? revisedPlan : item),
      }));
      setCostDraft(emptyCostDraft());
      setPendingRevision(null);
      setRevisionRequest("");
      setEditing(false);
      setRevisionFeedback({
        tone: "success",
        message: `Revision ${revisedPlan.revisionNumber} accepted. The updated allocation was recalculated and your recorded work was carried forward.`,
      });
    } catch (revisionError) {
      setRevisionFeedback({
        tone: "error",
        message: revisionError instanceof Error ? revisionError.message : "This revision could not be applied safely.",
      });
    }
  }

  function discardRevision() {
    focusPlanHeadingAfterRevision.current = true;
    setPendingRevision(null);
    setRevisionRequest("");
    setRevisionFeedback({ tone: "success", message: "Revision discarded. Your current plan remains unchanged." });
  }

  function restoreRevision() {
    try {
      const restoredPlan = restorePreviousPlanRevision(activePlan);
      focusPlanHeadingAfterRevision.current = true;
      updateWorkspace((current) => ({
        ...current,
        plans: current.plans.map((item) => item.id === restoredPlan.id ? restoredPlan : item),
      }));
      setPendingRevision(null);
      setRevisionRequest("");
      setRevisionFeedback({
        tone: "success",
        message: `Restored the previous plan state as revision ${restoredPlan.revisionNumber}. You can use this control again to toggle back until you make another edit.`,
      });
    } catch (restoreError) {
      setRevisionFeedback({
        tone: "error",
        message: restoreError instanceof Error ? restoreError.message : "The previous plan state could not be restored safely.",
      });
    }
  }

  function loadExample() {
    if (activePlan.edited && !window.confirm("Replace this plan with the synthetic example?")) return;
    const exampleBrief = exampleBriefForEvent(brief.eventType, brief);
    const example = createSavedPlan(exampleBrief, exampleBrief, getEventTemplateProposal(brief.eventType), activePlan.id, new Date().toISOString());
    setTodayDate(dateInTimeZone(new Date(), exampleBrief.timeZone) ?? "");
    updateWorkspace((current) => ({ ...current, plans: current.plans.map((item) => item.id === current.activePlanId ? example : item) }));
    clearEditorState();
  }

  function editProposal(update: (current: PlannerProposal) => PlannerProposal) {
    updateActivePlan((current) => {
      const proposal = update(current.proposal);
      const changedFields = (Object.keys(proposal) as (keyof PlannerProposal)[]).filter((field) => JSON.stringify(proposal[field]) !== JSON.stringify(current.proposal[field]));
      const manualProposalFields = [...new Set([...current.manualProposalFields, ...changedFields.filter((field): field is typeof current.manualProposalFields[number] => field === "conceptTitle" || field === "overview" || field === "theme")])];
      return { ...current, proposal, manualProposalFields, edited: true };
    });
  }

  function updateTask(taskId: string, update: (task: TaskRecord) => TaskRecord) {
    updateActivePlan((current) => ({
      ...current,
      edited: true,
      manualTaskIds: current.manualTaskIds.includes(taskId) ? current.manualTaskIds : [...current.manualTaskIds, taskId],
      tasks: current.tasks.map((task) => task.id === taskId ? update(task) : task),
    }));
  }

  function updateVendor(vendorId: string, update: (vendor: VendorRecord) => VendorRecord) {
    updateActivePlan((current) => ({ ...current, edited: true, vendors: current.vendors.map((vendor) => vendor.id === vendorId ? update(vendor) : vendor) }));
  }

  function updateCost(costId: string, update: (cost: CostItem) => CostItem) {
    updateActivePlan((current) => ({ ...current, edited: true, budget: { ...current.budget, reviewComplete: false, items: current.budget.items.map((cost) => cost.id === costId ? update(cost) : cost) } }));
  }

  function updateCostProjection(cost: CostItem, change: Partial<CostItem>, overpaymentMessage: string) {
    try {
      const candidate = { ...cost, ...change };
      const total = forecastCostItem(candidate, expectedGuestsForCostItem(activePlan, candidate)).lowerMinor;
      if (total !== null && cost.paidMinor > total) throw new Error(overpaymentMessage);
      updateCost(cost.id, (current) => ({ ...current, ...change, chargesReviewed: false }));
      setCostMessage("");
    } catch (costError) {
      setCostMessage(costError instanceof Error ? costError.message : "This change would make the cost forecast invalid.");
    }
  }

  function saveCostAdjustment(costId: string, adjustmentId: string | null, draft: CostAdjustmentDraft): boolean {
    try {
      const amountMinor = parseBudgetMinor(draft.amount, currency, true);
      const amountMaxMinor = draft.amountMax.trim() ? parseBudgetMinor(draft.amountMax, currency, true) : null;
      if (amountMaxMinor !== null && amountMaxMinor < amountMinor) throw new Error("The upper adjustment must be at least the lower amount.");
      const cost = activePlan.budget.items.find((item) => item.id === costId);
      if (!cost) throw new Error("This cost line is no longer available.");
      if (adjustmentId && !cost.adjustments.some((item) => item.id === adjustmentId)) {
        throw new Error("This adjustment line is no longer available.");
      }
      const adjustment: CostAdjustment = {
        id: adjustmentId ?? makeId(),
        kind: draft.kind,
        label: draft.label.trim(),
        pricingModel: draft.pricingModel,
        amountMinor,
        amountMaxMinor,
        sourceNote: draft.sourceNote.trim(),
      };
      const adjustments = adjustmentId
        ? cost.adjustments.map((item) => item.id === adjustmentId ? adjustment : item)
        : [...cost.adjustments, adjustment];
      const updatedCost: CostItem = {
        ...cost,
        adjustments,
        feesIncluded: draft.kind === "fee" ? false : cost.feesIncluded,
        taxesIncluded: draft.kind === "tax" ? false : cost.taxesIncluded,
        chargesReviewed: false,
      };
      const candidate = {
        ...activePlan,
        edited: true,
        budget: { ...activePlan.budget, reviewComplete: false, items: activePlan.budget.items.map((item) => item.id === costId ? updatedCost : item) },
      };
      const parsed = savedPlanSchema.safeParse(candidate);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the adjustment and its source.");
      updateActivePlan(() => parsed.data);
      setCostMessage("");
      return true;
    } catch (costError) {
      setCostMessage(costError instanceof Error ? costError.message : "Enter a valid adjustment amount.");
      return false;
    }
  }

  function removeCostAdjustment(costId: string, adjustmentId: string): boolean {
    const cost = activePlan.budget.items.find((item) => item.id === costId);
    if (!cost) return false;
    const candidate = {
      ...activePlan,
      edited: true,
      budget: {
        ...activePlan.budget,
        reviewComplete: false,
        items: activePlan.budget.items.map((item) => item.id === costId
          ? { ...item, adjustments: item.adjustments.filter((adjustment) => adjustment.id !== adjustmentId), chargesReviewed: false }
          : item),
      },
    };
    const parsed = savedPlanSchema.safeParse(candidate);
    if (!parsed.success) {
      setCostMessage(parsed.error.issues[0]?.message ?? "This adjustment could not be removed.");
      return false;
    }
    updateActivePlan(() => parsed.data);
    setCostMessage("");
    return true;
  }

  function updateChargeStatus(costId: string, field: "feesIncluded" | "taxesIncluded", value: boolean | null): boolean {
    const cost = activePlan.budget.items.find((item) => item.id === costId);
    if (!cost) return false;
    const matchingKind = field === "feesIncluded" ? "fee" : "tax";
    if (value === true && cost.adjustments.some((adjustment) => adjustment.kind === matchingKind)) {
      setCostMessage(`Remove or reclassify the separate ${matchingKind} line before marking it included.`);
      return false;
    }
    const candidate = {
      ...activePlan,
      edited: true,
      budget: {
        ...activePlan.budget,
        reviewComplete: false,
        items: activePlan.budget.items.map((item) => item.id === costId ? { ...item, [field]: value, chargesReviewed: false } : item),
      },
    };
    const parsed = savedPlanSchema.safeParse(candidate);
    if (!parsed.success) {
      setCostMessage(parsed.error.issues[0]?.message ?? "This charge status could not be saved.");
      return false;
    }
    updateActivePlan(() => parsed.data);
    setCostMessage("");
    return true;
  }

  function updateChargeReview(costId: string, checked: boolean): boolean {
    const candidate = {
      ...activePlan,
      edited: true,
      budget: {
        ...activePlan.budget,
        reviewComplete: false,
        items: activePlan.budget.items.map((item) => item.id === costId ? { ...item, chargesReviewed: checked } : item),
      },
    };
    const parsed = savedPlanSchema.safeParse(candidate);
    if (!parsed.success) {
      setCostMessage(parsed.error.issues[0]?.message ?? "Record a source and fee/tax status before completing this review.");
      return false;
    }
    updateActivePlan(() => parsed.data);
    setCostMessage("");
    return true;
  }

  function newPlan() {
    if (workspace.plans.length >= MAX_SAVED_PLANS) {
      setImportMessage(`A workspace can hold up to ${MAX_SAVED_PLANS} plans. Export one before adding another.`);
      return;
    }
    const id = makeId();
    const newBrief = exampleBriefForEvent(brief.eventType, brief);
    const planForWorkspace = createSavedPlan(newBrief, newBrief, getEventTemplateProposal(brief.eventType), id, new Date().toISOString());
    updateWorkspace((current) => ({ ...current, activePlanId: id, plans: [...current.plans, planForWorkspace] }));
    clearEditorState();
  }

  function deletePlan() {
    if (!window.confirm(`Delete “${activePlan.draftBrief.eventName}” from this device? This cannot be undone.`)) return;
    if (workspace.plans.length === 1) {
      const fresh = makeSeedPlan(brief.eventType, makeId());
      updateWorkspace(() => createWorkspace(fresh));
    } else {
      updateWorkspace((current) => {
        const remaining = current.plans.filter((item) => item.id !== current.activePlanId);
        return { ...current, activePlanId: remaining[0].id, plans: remaining };
      });
    }
    clearEditorState();
  }

  function exportPlan() {
    try {
      downloadJson(`${activePlan.draftBrief.eventName.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "mehfiloom-plan"}.json`, serializePlanDocument(activePlan));
      setImportMessage("Plan exported as a versioned JSON file.");
    } catch (exportError) {
      setImportMessage(exportError instanceof Error ? exportError.message : "This plan could not be exported yet. Fix invalid fields first.");
    }
  }

  async function importPlan(file: File) {
    if (file.size > MAX_PLAN_DOCUMENT_BYTES) {
      setImportMessage("This plan file is too large to import safely.");
      return;
    }
    if (workspace.plans.length >= MAX_SAVED_PLANS) {
      setImportMessage(`A workspace can hold up to ${MAX_SAVED_PLANS} plans. Export one before importing.`);
      return;
    }
    try {
      const imported = reidentifyPlan(parsePlanDocument(await file.text()));
      setTodayDate(dateInTimeZone(new Date(), imported.draftBrief.timeZone) ?? "");
      updateWorkspace((current) => ({ ...current, activePlanId: imported.id, plans: [...current.plans, imported] }));
      clearEditorState();
      setImportMessage("Plan imported and given new local IDs. Review its costs and bookings.");
    } catch (importError) {
      setImportMessage(importError instanceof Error ? importError.message : "This plan file could not be imported.");
    }
  }

  function addCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let amountMinor: number | null = null;
    let amountMaxMinor: number | null = null;
    if (costDraft.evidence !== "unpriced") {
      try {
        amountMinor = parseBudgetMinor(costDraft.amount, currency);
        amountMaxMinor = costDraft.maxAmount.trim() ? parseBudgetMinor(costDraft.maxAmount, currency) : null;
        if (amountMaxMinor !== null && amountMinor > amountMaxMinor) throw new Error("The upper amount must be at least the lower amount.");
        if (costDraft.evidence === "committed" && amountMaxMinor !== null && amountMaxMinor !== amountMinor) throw new Error("A commitment needs one exact amount; clear the upper amount.");
      }
      catch (costError) { setCostMessage(costError instanceof Error ? costError.message : "Enter a valid cost amount."); return; }
    }
    const cost: CostItem = {
      id: makeId(), label: costDraft.label.trim(), category: costDraft.category, vendorId: null, sessionId: costDraft.sessionId,
      amountMinor, amountMaxMinor, pricingModel: costDraft.pricingModel, evidence: costDraft.evidence, paidMinor: 0, payments: [], mandatory: costDraft.mandatory,
      validUntil: null, minimumGuestCount: null, feesIncluded: null, taxesIncluded: null, chargesReviewed: false, adjustments: [], exclusions: [], sourceNote: "",
    };
    if (cost.label.length < 2) { setCostMessage("Give the cost line a short label first."); return; }
    updateActivePlan((current) => ({ ...current, edited: true, budget: { ...current.budget, reviewComplete: false, items: [...current.budget.items, cost] } }));
    setCostDraft(emptyCostDraft());
    setCostMessage("");
  }

  function removeCost(costId: string) {
    updateActivePlan((current) => ({ ...current, edited: true, budget: { ...current.budget, reviewComplete: false, items: current.budget.items.filter((item) => item.id !== costId) } }));
    setAmountDrafts((current) => { const next = { ...current }; delete next[costId]; delete next[`${costId}:max`]; return next; });
    setPaymentDrafts((current) => { const next = { ...current }; delete next[costId]; return next; });
  }

  function resetUnreadableStorage() {
    if (!window.confirm("Replace unreadable local data with a new synthetic example workspace? Exported files are not affected.")) return;
    try {
      clearWorkspaceStorage(window.localStorage);
      const fresh = createWorkspace(makeSeedPlan(initialEventType, makeId()));
      setTodayDate(dateInTimeZone(new Date(), fresh.plans[0]?.draftBrief.timeZone ?? null) ?? "");
      setWorkspace(fresh);
      setStorageLoadFailed(false);
      setStorageError("");
      setStorageStatus("New local workspace");
    } catch (resetError) {
      setStorageError(resetError instanceof Error ? resetError.message : "Could not reset local workspace data.");
    }
  }

  function retryLoadingStorage() {
    setStorageReady(false);
    setStorageLoadFailed(false);
    setStorageError("");
    setStorageStatus("Loading plans on this device…");
    setStorageLoadAttempt((attempt) => attempt + 1);
  }

  function retryWorkspaceSave() {
    if (!storageReady || storageLoadFailed) return;
    setStorageStatus("Saving changes on this device…");
    try {
      saveWorkspaceToStorage(window.localStorage, workspace);
      setStorageError("");
      setStorageStatus("Saved on this device");
    } catch (saveError) {
      setStorageError(saveError instanceof Error ? saveError.message : "The browser could not save this workspace.");
      setStorageStatus("Changes are not saved");
    }
  }

  function updateAmountOnBlur(cost: CostItem, value: string) {
    try {
      if (!value.trim()) {
        if (cost.paidMinor > 0) throw new Error("Clear the recorded payment before removing its commitment amount.");
        updateCost(cost.id, (current) => ({ ...current, amountMinor: null, amountMaxMinor: null, evidence: "unpriced", paidMinor: 0 }));
      } else {
        const amountMinor = parseBudgetMinor(value, currency);
        if (cost.amountMaxMinor !== null && amountMinor > cost.amountMaxMinor) throw new Error("The lower amount cannot exceed the upper amount.");
        const commitmentTotal = forecastCostItem({ ...cost, amountMinor }, expectedGuestsForCostItem(activePlan, cost)).lowerMinor;
        if (commitmentTotal !== null && cost.paidMinor > commitmentTotal) throw new Error("Amount cannot be less than the payment already recorded.");
        updateCost(cost.id, (current) => ({ ...current, amountMinor, chargesReviewed: false, evidence: evidenceAfterAmountEntry(current.evidence) }));
      }
      setCostMessage("");
    } catch (costError) {
      setCostMessage(costError instanceof Error ? costError.message : "Enter a valid amount.");
      setAmountDrafts((current) => ({ ...current, [cost.id]: amountInput(cost.amountMinor, currency) }));
    }
  }

  function updateMaxAmountOnBlur(cost: CostItem, value: string) {
    try {
      const amountMaxMinor = value.trim() ? parseBudgetMinor(value, currency) : null;
      if (amountMaxMinor !== null && cost.amountMinor !== null && amountMaxMinor < cost.amountMinor) throw new Error("The upper amount must be at least the lower amount.");
      if (cost.evidence === "committed" && amountMaxMinor !== null && amountMaxMinor !== cost.amountMinor) throw new Error("A commitment needs one exact amount; clear the upper amount.");
      updateCost(cost.id, (current) => ({ ...current, amountMaxMinor, chargesReviewed: false }));
      setCostMessage("");
    } catch (costError) {
      setCostMessage(costError instanceof Error ? costError.message : "Enter a valid upper amount.");
      setAmountDrafts((current) => ({ ...current, [`${cost.id}:max`]: amountInput(cost.amountMaxMinor, currency) }));
    }
  }

  function updatePaymentDraft(costId: string, field: keyof PaymentDraft, value: string) {
    setPaymentDrafts((current) => {
      const previous = current[costId];
      return {
        ...current,
        [costId]: {
          amount: previous?.amount ?? "",
          paidAt: previous?.paidAt ?? "",
          note: previous?.note ?? "",
          [field]: value,
        },
      };
    });
  }

  function addPayment(cost: CostItem) {
    try {
      if (cost.evidence !== "committed") throw new Error("Mark this item as committed before recording a payment.");
      const draft = paymentDrafts[cost.id] ?? { amount: "", paidAt: "", note: "" };
      const amountMinor = parseBudgetMinor(draft.amount, currency);
      const commitmentTotal = forecastCostItem(cost, expectedGuestsForCostItem(activePlan, cost)).lowerMinor;
      const payment = { id: makeId(), amountMinor, paidAt: draft.paidAt || null, note: draft.note.trim() };
      const updatedCost = addCostPayment(cost, payment, commitmentTotal);
      updateCost(cost.id, () => updatedCost);
      setPaymentDrafts((current) => { const next = { ...current }; delete next[cost.id]; return next; });
      setCostMessage("");
    } catch (costError) {
      setCostMessage(costError instanceof Error ? costError.message : "Enter a valid payment amount.");
    }
  }

  function removePayment(cost: CostItem, paymentId: string) {
    try {
      const updatedCost = removeCostPayment(cost, paymentId);
      updateCost(cost.id, () => updatedCost);
      setCostMessage("");
    } catch (paymentError) {
      setCostMessage(paymentError instanceof Error ? paymentError.message : "Could not remove this payment.");
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark"><BrandMark /></span>
          <span className="brand-name">Mehfiloom<span className="brand-dot">.</span></span>
        </Link>
        <div className="topbar-center"><span className="status-dot" /> Planning a {EVENT_LABELS[brief.eventType].toLowerCase()}</div>
        <Link className="topbar-link" href={`/${brief.eventType}`}>About this plan <ArrowRight size={15} /></Link>
      </header>

      <main id="main-content" className="main-wrap" tabIndex={-1}>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={14} /> {EVENT_WELCOME[brief.eventType].eyebrow}</div>
            <h1>{EVENT_WELCOME[brief.eventType].headline}</h1>
            <p>{EVENT_WELCOME[brief.eventType].copy}</p>
            <div className="hero-tags" aria-label="What this planner helps organize">
              <span>Budget</span><span>Timeline</span><span>{brief.eventType === "community" ? "Vendor & volunteer questions" : "Vendor checklist"}</span><span>Personal ideas</span>
            </div>
          </div>
          <div className={`planner-cover planner-cover-${brief.eventType}`} aria-hidden="true">
            <span>THE GATHERING, WELL PLANNED</span>
            <strong>Room for<br />what matters.</strong>
            <small>{EVENT_LABELS[brief.eventType].toUpperCase()} · A PRIVATE FIRST DRAFT</small>
          </div>
        </section>

        <section id="workspace" className="workspace-toolbar" aria-label="Plan library">
          <label className="plan-picker"><span>Local plans</span><select value={workspace.activePlanId} onChange={(event) => selectPlan(event.target.value)}>
            {workspace.plans.map((item) => <option value={item.id} key={item.id}>{item.draftBrief.eventName || "Untitled celebration"}</option>)}
          </select></label>
          <div className="toolbar-actions">
            <span className={`save-indicator ${storageStatus === "Saved on this device" ? "is-saved" : ""}`} role="status" aria-live="polite" aria-atomic="true"><span className="save-dot" aria-hidden="true" />{storageStatus}</span>
            <button type="button" onClick={newPlan}><Plus size={15} /> New plan</button>
            <PlanFileActions onExport={exportPlan} onImport={importPlan} onPrint={() => window.print()} />
            <button className="delete-plan-button" type="button" onClick={deletePlan}><Trash2 size={15} /> Delete</button>
          </div>
          {storageError && <div className="workspace-message is-error" role="alert">
            <p>{storageLoadFailed
              ? `Saved plans could not be loaded (${storageError}). The displayed plan is only in this tab. Export each plan you changed before retrying or resetting; saved data will not be replaced unless you reset it.`
              : `Changes are only in this tab because the browser could not save them (${storageError}). Export the active plan before reloading, or retry saving.`}</p>
            <div className="workspace-message-actions">
              {storageLoadFailed && <>
                <button type="button" onClick={retryLoadingStorage}>Retry loading</button>
                <button type="button" onClick={resetUnreadableStorage}>Reset local plans</button>
              </>}
              {!storageLoadFailed && storageStatus === "Changes are not saved" && <button type="button" onClick={retryWorkspaceSave}>Retry save</button>}
            </div>
          </div>}
          {!storageReady && <div className="workspace-message" role="status" aria-live="polite">Loading saved plans from this browser…</div>}
          {importMessage && <div className="workspace-message" role="status">{importMessage}</div>}
          <p className="local-storage-note">Plans stay in this browser on this device. Export JSON to keep a backup or move a plan. Guest names are never collected.</p>
        </section>

        <div className="workspace-grid">
          <EventBriefForm
            brief={brief}
            eventTimeResolution={eventTimeResolution}
            eventTimeDisplay={eventTimeDisplay}
            sessionTimeResolutions={sessionTimeResolutions}
            errorTargetId={errorTargetId}
            error={error}
            generationAnnouncement={generationAnnouncement}
            generating={generating}
            hasPendingRevision={pendingRevision !== null}
            isRevision={activePlan.origin === "ai"}
            revisionRequest={revisionRequest}
            onRevisionRequestChange={setRevisionRequest}
            onLoadExample={loadExample}
            onSubmit={generate}
            onUpdateBrief={updateBrief}
          />

          <section className="plan-card" aria-labelledby="plan-heading">
            <div className="plan-header"><div><div className="card-kicker"><span className="step-number step-two">02</span> YOUR PLANNING CANVAS</div><div className="plan-title-row"><h2 id="plan-heading" ref={planHeadingRef} tabIndex={-1}>A plan taking shape</h2><span className={`origin-badge ${activePlan.origin === "ai" ? "origin-ai" : "origin-example"}`}><span className="badge-dot" /> {activePlan.origin === "ai" ? "AI draft · review needed" : "Example plan · synthetic"}</span></div><p className="plan-subtitle">A working canvas for your ideas, budget, and next steps.</p></div><button className={`edit-button ${editing ? "is-editing" : ""}`} type="button" onClick={() => setEditing((value) => !value)}>{editing ? <Check size={15} /> : <ClipboardList size={15} />}{editing ? "Done editing" : "Edit draft"}</button></div>
            <PlanVerificationNotice mustHaves={submittedBrief.mustHaves} modelGenerated={activePlan.origin === "ai"} />
            {briefChanged && <div className="stale-notice"><CircleAlert size={16} /> The brief has changed since this draft was made. Generate again to refresh its suggestions.</div>}
            {revisionFeedback && <div className={`revision-feedback revision-feedback-${revisionFeedback.tone}`} role={revisionFeedback.tone === "error" ? "alert" : "status"}>{revisionFeedback.message}</div>}
            {activePlan.undoRevision && <div className="revision-restore"><div><strong>Recent change</strong><span>{canRestoreRevision ? "You can restore the state from just before the last accepted revision." : "This plan has changed since that revision. The earlier state is kept, but restoring it now could remove newer work."}</span></div>{canRestoreRevision && <button className="revision-discard-button" type="button" onClick={restoreRevision}>Restore previous state</button>}</div>}
            {pendingRevision && <RevisionReviewPanel pendingRevision={pendingRevision} isStale={pendingRevisionIsStale} onAccept={acceptRevision} onDiscard={discardRevision} />}
            {guestsOverExpected && <div className="stale-notice"><CircleAlert size={16} /> Confirmed guests exceed the expected count. Update the event brief before relying on the allocation.</div>}
            {sessionsOverExpected.length > 0 && <div className="stale-notice"><CircleAlert size={16} /> Confirmed attendance exceeds the estimate for {sessionsOverExpected.map((attendance) => submittedBrief.sessions.find((session) => session.id === attendance.sessionId)?.name).filter(Boolean).join(", ")}. Update that session estimate before relying on its forecast.</div>}
            {quoteMinimumsOverExpected.length > 0 && <div className="stale-notice"><CircleAlert size={16} /> {quoteMinimumsOverExpected.length} cost line{quoteMinimumsOverExpected.length === 1 ? " has" : "s have"} a vendor minimum above expected attendance.</div>}
            <div className="event-summary-strip"><div className="summary-main"><span className="summary-icon"><Flower2 size={18} /></span><span><strong>{submittedBrief.eventName || "Your celebration"}</strong><small>{EVENT_LABELS[submittedBrief.eventType]} · {submittedBrief.location || "Location to decide"}</small></span></div><div className="summary-meta"><span><CalendarDays size={15} />{submittedBrief.eventDate || "Date to decide"}</span><span><UsersRound size={15} />{submittedBrief.guestCount || "—"} guests</span></div></div>
            <div className="guest-summary"><label>Unique confirmed guests <small>count only · no names</small><input aria-label="Unique confirmed guest count" type="number" min={0} max={10000} value={activePlan.guestSummary.confirmed ?? ""} placeholder="Not counted yet" onChange={(event) => updateActivePlan((current) => ({ ...current, guestSummary: { ...current.guestSummary, confirmed: event.target.value === "" ? null : Number(event.target.value) } }))} /></label><span>{activePlan.guestSummary.confirmed === null ? "One overall count; no names are collected." : `${activePlan.guestSummary.confirmed} unique confirmed of ${activePlan.guestSummary.expected} expected`}</span></div>
            {submittedBrief.sessions.length > 0 && <section className="session-attendance" aria-labelledby="session-attendance-heading"><div><span className="section-label">ATTENDANCE BY SESSION</span><h3 id="session-attendance-heading">People at each part</h3><p>Counts can overlap when someone attends multiple sessions. They are kept separate and never added to your unique event total.</p></div><div className="session-attendance-list">{submittedBrief.sessions.map((session) => {
              const attendance = activePlan.sessionAttendance.find((item) => item.sessionId === session.id);
              return <label className="session-attendance-row" key={session.id}><span><strong>{session.name}</strong><small>{session.guestCount} expected{session.date ? ` · ${session.date}` : ""}</small></span><span><small>Confirmed · names not stored</small><input aria-label={`Confirmed guests for ${session.name}`} type="number" min={0} max={10000} value={attendance?.confirmedGuests ?? ""} placeholder="Not counted" onChange={(event) => updateActivePlan((current) => ({ ...current, sessionAttendance: current.sessionAttendance.map((item) => item.sessionId === session.id ? { ...item, confirmedGuests: event.target.value === "" ? null : Number(event.target.value) } : item) }))} /></span></label>;
            })}</div></section>}
            {submittedBrief.mustHaves && <div className="must-have-strip"><span>HOST MUST-HAVES</span><p>{submittedBrief.mustHaves}</p></div>}

            <div className="plan-overview"><div className="plan-overview-copy"><span className="section-label"><span className="tiny-spark">✦</span> THE STARTING IDEA</span>{editing ? <><input className="edit-title-input" aria-label="Plan title" value={proposal.conceptTitle} onChange={(e) => editProposal((current) => ({ ...current, conceptTitle: e.target.value }))} maxLength={80} /><textarea className="edit-overview-input" aria-label="Plan overview" value={proposal.overview} onChange={(e) => editProposal((current) => ({ ...current, overview: e.target.value }))} maxLength={500} rows={4} /></> : <><h3>{proposal.conceptTitle}</h3><p>{proposal.overview}</p></>}<div className="theme-note"><span className="theme-flower">✿</span><span><small>THE FEEL</small>{editing ? <input aria-label="Event theme" value={proposal.theme} onChange={(e) => editProposal((current) => ({ ...current, theme: e.target.value }))} maxLength={100} /> : proposal.theme}</span></div></div><div className="overview-art" aria-hidden="true"><span className="art-leaf leaf-a">❧</span><span className="art-flower">✿</span><span className="art-leaf leaf-b">❧</span><span className="art-orbit" /></div></div>

            <div className="section-heading budget-heading"><div><span className="section-label">THE BUDGET PICTURE</span><h3>Give every part a place</h3></div><span className="budget-total">{formatMoney(plan.totalMinor, plan.currency)} <small>planning cap</small></span></div>
            <BudgetAllocationPanel lines={plan.lines} totalMinor={budgetTotal} currency={plan.currency} />

            <TaskTimelineSection
              tasks={activePlan.tasks}
              eventDate={brief.eventDate}
              sessions={brief.sessions}
              sessionOptions={submittedBrief.sessions}
              editing={editing}
              scheduleConflicts={scheduleConflicts}
              onUpdateTask={updateTask}
            />
            <section className="costs-section" aria-labelledby="cost-heading"><div className="section-heading compact-heading"><div><span className="section-label">KNOWN, QUOTED &amp; STILL TO CHECK</span><h3 id="cost-heading">Cost register</h3></div><span className="soft-icon"><CircleCheck size={16} /></span></div>
              {budgetHealth ? <div className={`budget-health health-${budgetHealth.state}`}><div><strong>{budgetHealth.state === "within_cap" ? "Recorded costs plus reserve fit the cap" : budgetHealth.state === "over_cap" ? "Recorded costs plus reserve exceed the cap" : budgetHealth.state === "range_crosses_cap" ? "Cost range crosses the cap" : activePlan.budget.reviewComplete ? "Review mandatory costs and fees" : "Budget review is still open"}</strong><small>{budgetHealth.unresolvedCount} unpriced · {budgetHealth.unresolvedMandatoryCount} mandatory and unpriced · {budgetHealth.unresolvedMandatoryChargeCount} mandatory fee/tax reviews unresolved</small></div><div className="health-number">{moneyRange(budgetHealth.forecastWithReserveMinor, budgetHealth.forecastWithReserveMaxMinor, currency)}<small>forecast including reserve</small></div></div> : <div className="budget-health health-unknown"><strong>Fix invalid plan fields to recalculate the budget.</strong></div>}
              {budgetHealth && budgetHealth.state === "over_cap" && <div className="form-error" role="alert"><CircleAlert size={16} /><span>This recorded forecast is above the cap. Reduce costs or revise the cap before treating the plan as feasible.</span></div>}
              {budgetHealth?.state === "range_crosses_cap" && <div className="form-error" role="alert"><CircleAlert size={16} /><span>The upper forecast exceeds the cap; this range cannot be treated as affordable.</span></div>}
              <div className="cost-rollup"><span>Cap <strong>{formatMoney(activePlan.budget.capMinor, currency)}</strong></span><span>Known costs <strong>{moneyRange(budgetHealth?.knownCostsMinor ?? 0, budgetHealth?.knownCostsMaxMinor ?? 0, currency)}</strong></span><span>Reserve <strong>{formatMoney(budgetHealth?.reserveMinor ?? 0, currency)}</strong></span><span>Paid <strong>{formatMoney(budgetHealth?.paidMinor ?? 0, currency)}</strong></span><span>Committed outstanding <strong>{formatMoney(budgetHealth?.outstandingCommittedMinor ?? 0, currency)}</strong></span></div>
              <div className="cost-list">{activePlan.budget.items.map((cost) => <article className="cost-item" key={cost.id}><div className="cost-item-head"><div><strong>{cost.label}</strong><small>{CATEGORY_LABELS[cost.category]} · {sessionScopeLabel(submittedBrief.sessions, cost.sessionId)} · {costEvidenceSummary(cost, currency, expectedGuestsForCostItem(activePlan, cost))}</small></div>{editing && <button className="icon-button" type="button" onClick={() => removeCost(cost.id)} aria-label={`Remove ${cost.label}`}><Trash2 size={15} /></button>}</div>
                {editing ? <div className="cost-edit-grid"><label>Line label<input value={cost.label} maxLength={100} onChange={(event) => updateCost(cost.id, (current) => ({ ...current, label: event.target.value }))} /></label><label>Category<select value={cost.category} onChange={(event) => updateCost(cost.id, (current) => ({ ...current, category: event.target.value as CostItem["category"] }))}>{BUDGET_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}</select></label><label>Applies to<select value={cost.sessionId ?? ""} onChange={(event) => { const sessionId = event.target.value || null; updateCostProjection(cost, { sessionId }, "This session has a smaller commitment total than the amount already paid."); }}><option value="">Shared / whole event</option>{submittedBrief.sessions.map((session) => <option value={session.id} key={session.id}>{session.name}</option>)}</select></label><label>Price basis<select value={cost.pricingModel} onChange={(event) => { const pricingModel = event.target.value as CostItem["pricingModel"]; updateCostProjection(cost, { pricingModel }, "The new price basis would put paid amount above the commitment."); }}><option value="fixed">Fixed total</option><option value="per_guest">Per guest</option></select></label><label>{cost.pricingModel === "per_guest" ? "Rate per guest (" + currency + ")" : "Lower amount (" + currency + ")"}<input inputMode="decimal" value={amountDrafts[cost.id] ?? amountInput(cost.amountMinor, currency)} placeholder="Unknown" onChange={(event) => setAmountDrafts((current) => ({ ...current, [cost.id]: event.target.value }))} onBlur={(event) => updateAmountOnBlur(cost, event.target.value)} /></label><label>Upper amount / rate ({currency})<input inputMode="decimal" value={amountDrafts[cost.id + ":max"] ?? amountInput(cost.amountMaxMinor, currency)} placeholder="Same as lower" disabled={cost.evidence === "committed"} onChange={(event) => setAmountDrafts((current) => ({ ...current, [cost.id + ":max"]: event.target.value }))} onBlur={(event) => updateMaxAmountOnBlur(cost, event.target.value)} /></label><label>Evidence<select value={cost.evidence} onChange={(event) => { const evidence = event.target.value as CostItem["evidence"]; if (evidence !== "committed" && cost.payments.length > 0) { setCostMessage("Remove recorded payments before changing this cost from committed."); return; } if (evidence !== "unpriced" && cost.amountMinor === null) { setCostMessage("Enter an amount before marking this cost as an estimate, quote, or commitment."); return; } if (evidence === "committed" && cost.amountMaxMinor !== null && cost.amountMaxMinor !== cost.amountMinor) { setCostMessage("Clear the upper amount before recording an exact commitment."); return; } if (evidence === "committed" && cost.adjustments.some((adjustment) => adjustment.amountMaxMinor !== null && adjustment.amountMaxMinor !== adjustment.amountMinor)) { setCostMessage("Use exact sourced adjustment amounts before recording a commitment."); return; } setCostMessage(""); updateCost(cost.id, (current) => ({ ...current, evidence, chargesReviewed: false, ...(evidence === "unpriced" ? { amountMinor: null, amountMaxMinor: null, paidMinor: 0 } : {}) })); }}><option value="unpriced">Unpriced</option><option value="estimate">Estimate</option><option value="quote">Quote</option><option value="committed">Committed</option></select></label><label className="checkbox-field"><input type="checkbox" checked={cost.mandatory} onChange={(event) => updateCost(cost.id, (current) => ({ ...current, mandatory: event.target.checked }))} /> Mandatory to the event</label><label>Quote valid until<input type="date" value={cost.validUntil ?? ""} onChange={(event) => updateCost(cost.id, (current) => ({ ...current, validUntil: event.target.value || null }))} />{cost.evidence === "quote" && (quoteValidityStatus(cost, quoteTodayDate) === "expired" ? <small className="quote-review-warning">Expired; reconfirm before relying on the price.</small> : quoteValidityStatus(cost, quoteTodayDate) === "unknown" ? <small className="quote-review-warning">Validity date unknown.</small> : <small>Validity through the selected date.</small>)}</label><label>Minimum guests<input type="number" min={1} max={10000} value={cost.minimumGuestCount ?? ""} onChange={(event) => updateCostProjection(cost, { minimumGuestCount: event.target.value ? Number(event.target.value) : null }, "The minimum guest count would put paid amount above the commitment.")} />{cost.pricingModel === "per_guest" && cost.minimumGuestCount === null && <small>Minimum guest count unknown.</small>}</label><label>Quote source<textarea value={cost.sourceNote} maxLength={300} onChange={(event) => updateCost(cost.id, (current) => ({ ...current, sourceNote: event.target.value, chargesReviewed: false }))} placeholder="Vendor, email, or quote reference." /></label><label className="field-wide">Exclusions (one per line)<textarea value={cost.exclusions.join("\n")} maxLength={2000} onChange={(event) => { try { const exclusions = parseCostExclusions(event.target.value); updateCost(cost.id, (current) => ({ ...current, exclusions, chargesReviewed: false })); setCostMessage(""); } catch (exclusionError) { setCostMessage(exclusionError instanceof Error ? exclusionError.message : "Enter valid exclusions."); } }} placeholder="e.g. delivery, setup, overtime" /><small>Up to 12 exclusions, each 160 characters or fewer.</small></label></div> : <div className="cost-evidence"><span>{cost.sourceNote || "No source recorded."}</span>{quoteValidityMessage(cost, quoteTodayDate) && <small className={quoteValidityStatus(cost, quoteTodayDate) === "expired" || quoteValidityStatus(cost, quoteTodayDate) === "unknown" ? "quote-review-warning" : undefined}>{quoteValidityMessage(cost, quoteTodayDate)}</small>}{cost.minimumGuestCount !== null ? <small>Minimum guests: {cost.minimumGuestCount}</small> : cost.pricingModel === "per_guest" ? <small>Minimum guest count unknown.</small> : null}{cost.exclusions.length > 0 ? <small>Exclusions: {cost.exclusions.join("; ")}</small> : cost.evidence === "quote" ? <small>Exclusions not recorded.</small> : null}</div>}<CostAdjustmentsEditor cost={cost} expectedGuests={expectedGuestsForCostItem(activePlan, cost)} currency={currency} editing={editing} onSave={(adjustmentId, draft) => saveCostAdjustment(cost.id, adjustmentId, draft)} onRemove={(adjustmentId) => removeCostAdjustment(cost.id, adjustmentId)} onChargeStatus={(field, value) => updateChargeStatus(cost.id, field, value)} onReview={(checked) => updateChargeReview(cost.id, checked)} /><PaymentHistoryPanel cost={cost} currency={currency} editing={editing} draft={paymentDrafts[cost.id] ?? { amount: "", paidAt: "", note: "" }} onDraftChange={(field, value) => updatePaymentDraft(cost.id, field, value)} onAdd={() => addPayment(cost)} onRemove={(paymentId) => removePayment(cost, paymentId)} /></article>)}</div>
              <form className="add-cost-form" onSubmit={addCost}><h4>Add a cost or quote</h4><div className="add-cost-grid"><label>Label<input required minLength={2} maxLength={100} value={costDraft.label} onChange={(event) => setCostDraft((current) => ({ ...current, label: event.target.value }))} placeholder="e.g. Community hall" /></label><label>Category<select value={costDraft.category} onChange={(event) => setCostDraft((current) => ({ ...current, category: event.target.value as CostItem["category"] }))}>{BUDGET_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}</select></label><label>Applies to<select value={costDraft.sessionId ?? ""} onChange={(event) => setCostDraft((current) => ({ ...current, sessionId: event.target.value || null }))}><option value="">Shared / whole event</option>{submittedBrief.sessions.map((session) => <option value={session.id} key={session.id}>{session.name}</option>)}</select></label><label>Price basis<select value={costDraft.pricingModel} onChange={(event) => setCostDraft((current) => ({ ...current, pricingModel: event.target.value as CostItem["pricingModel"] }))}><option value="fixed">Fixed total</option><option value="per_guest">Per guest</option></select></label><label>Evidence<select value={costDraft.evidence} onChange={(event) => { const evidence = event.target.value as CostItem["evidence"]; if (evidence === "committed" && costDraft.maxAmount.trim()) { try { if (parseBudgetMinor(costDraft.maxAmount, currency) !== parseBudgetMinor(costDraft.amount, currency)) throw new Error(); } catch { setCostMessage("Clear the upper amount before choosing an exact commitment."); return; } } setCostMessage(""); setCostDraft((current) => ({ ...current, evidence })); }}><option value="unpriced">Unpriced</option><option value="estimate">Estimate</option><option value="quote">Quote</option><option value="committed">Committed</option></select></label><label>Lower amount / rate ({currency})<input inputMode="decimal" value={costDraft.amount} disabled={costDraft.evidence === "unpriced"} onChange={(event) => setCostDraft((current) => ({ ...current, amount: event.target.value }))} placeholder={costDraft.evidence === "unpriced" ? "No amount yet" : "e.g. 1200"} /></label><label>Upper amount / rate ({currency})<input inputMode="decimal" value={costDraft.maxAmount} disabled={costDraft.evidence === "unpriced" || costDraft.evidence === "committed"} onChange={(event) => setCostDraft((current) => ({ ...current, maxAmount: event.target.value }))} placeholder="Same as lower" /></label><label className="checkbox-field"><input type="checkbox" checked={costDraft.mandatory} onChange={(event) => setCostDraft((current) => ({ ...current, mandatory: event.target.checked }))} /> Mandatory</label><button type="submit"><Plus size={15} /> Add cost</button></div></form>
              <label className="review-checkbox"><input type="checkbox" checked={activePlan.budget.reviewComplete} onChange={(event) => updateActivePlan((current) => ({ ...current, budget: { ...current.budget, reviewComplete: event.target.checked } }))} /> I reviewed the recorded costs and know what remains unknown.</label>
              {costMessage && <div className="form-error cost-form-message" role="status"><CircleAlert size={16} /><span>{costMessage}</span></div>}
            </section>

            <div className="lower-grid"><section className="ideas-section"><div className="section-heading compact-heading"><div><span className="section-label">PERSONAL TOUCHES</span><h3>Ideas that fit</h3></div><span className="soft-icon"><Sparkles size={16} /></span></div><div className="ideas-list">{proposal.ideas.map((idea, index) => <article className="idea-item" key={`${index}-${idea.title}`}><span className={`idea-number idea-number-${index % 3}`}>0{index + 1}</span><div><strong>{idea.title}</strong><p>{idea.whyItFits}</p><small>{idea.costNote}</small></div></article>)}</div></section>
              <VendorChecklistSection vendors={activePlan.vendors} editing={editing} onUpdateVendor={updateVendor} />
            </div>
            <div className="questions-box"><div><span className="section-label">KEEP THESE VISIBLE</span><h3>Open questions &amp; assumptions</h3></div><div className="question-columns"><div><strong>Worth deciding</strong><ul>{proposal.openQuestions.map((item, index) => <li key={index}>{item}</li>)}</ul></div><div><strong>Currently assumed</strong><ul>{proposal.assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul></div></div></div>
            <div className="plan-footer"><span><CircleAlert size={15} /> You stay in charge of costs, bookings, and final decisions.</span><span>Made for thoughtful hosts.</span></div>
          </section>
        </div>
        <article className="print-plan-document" aria-label="Printable event plan">
          <header className="print-document-heading">
            <span>MEHFILOOM · PRIVATE PLANNING COPY</span>
            <h1>{submittedBrief.eventName || "Untitled celebration"}</h1>
            <p>{EVENT_LABELS[submittedBrief.eventType]} · {submittedBrief.location || "Location to confirm"} · {submittedBrief.eventDate || "Date to confirm"}{submittedBrief.timeZone ? ` · ${submittedBrief.timeZone}` : ""}{submittedEventTimeDisplay ? ` · ${submittedEventTimeDisplay}` : ""}</p>
            <dl className="print-summary-grid">
              <div><dt>Expected guests</dt><dd>{submittedBrief.guestCount}</dd></div>
              <div><dt>Budget cap</dt><dd>{formatMoney(activePlan.budget.capMinor, currency)}</dd></div>
              <div><dt>Budget review</dt><dd>{activePlan.budget.reviewComplete ? "Marked complete" : "Still open"}</dd></div>
              <div><dt>Plan version</dt><dd>{activePlan.revisionNumber}</dd></div>
            </dl>
          </header>

          {storageStatus !== "Saved on this device" && <p className="print-caution">Local save status: {storageStatus}. This copy reflects the active plan shown in this browser tab.</p>}

          <section className="print-section">
            <h2>Event brief</h2>
            <dl className="print-detail-grid">
              <div><dt>Planning style</dt><dd>{submittedBrief.style || "Not specified"}</dd></div>
              <div><dt>Must-haves and access needs</dt><dd>{submittedBrief.mustHaves || "None recorded"}</dd></div>
            </dl>
            {submittedBrief.sessions.length > 0 && <div>
              <h3>Functions and sessions</h3>
              <ul>{submittedBrief.sessions.map((session) => {
                const attendance = activePlan.sessionAttendance.find((item) => item.sessionId === session.id);
                const sessionTime = resolveZonedDateTime(session.date, session.startTime, submittedBrief.timeZone, session.startTimeOccurrence);
                const sessionTimeDisplay = formatZonedInstant(sessionTime.instant, submittedBrief.timeZone);
                return <li key={session.id}>{session.name || "Unnamed session"} · {session.date || "Date to confirm"}{sessionTimeDisplay ? ` · ${sessionTimeDisplay}` : ""} · {session.guestCount} expected guests · {attendance?.confirmedGuests ?? "not confirmed"} confirmed</li>;
              })}</ul>
            </div>}
          </section>

          <section className="print-section">
            <h2>Starting idea</h2>
            <h3>{proposal.conceptTitle}</h3>
            <p>{proposal.overview}</p>
            <p><strong>The feel:</strong> {proposal.theme}</p>
          </section>

          <section className="print-section">
            <h2>Budget plan</h2>
            <p className="print-note">Planning targets only; these allocations are not vendor quotes.</p>
            <table className="print-table">
              <thead><tr><th scope="col">Category</th><th scope="col">Allocation</th><th scope="col">Planning note</th></tr></thead>
              <tbody>{plan.lines.map((line, index) => {
                const category = BUDGET_CATEGORIES.find((item) => item === line.category);
                return <tr key={`${line.category}-${index}`}><th scope="row">{category ? CATEGORY_LABELS[category] : line.category}</th><td>{formatMoney(line.amountMinor, currency)}</td><td>{line.rationale}</td></tr>;
              })}</tbody>
            </table>
            <dl className="print-summary-grid print-budget-summary">
              <div><dt>Known costs</dt><dd>{moneyRange(budgetHealth?.knownCostsMinor ?? 0, budgetHealth?.knownCostsMaxMinor ?? 0, currency)}</dd></div>
              <div><dt>Reserve</dt><dd>{formatMoney(budgetHealth?.reserveMinor ?? 0, currency)}</dd></div>
              <div><dt>Paid</dt><dd>{formatMoney(budgetHealth?.paidMinor ?? 0, currency)}</dd></div>
              <div><dt>Committed outstanding</dt><dd>{formatMoney(budgetHealth?.outstandingCommittedMinor ?? 0, currency)}</dd></div>
            </dl>
          </section>

          <section className="print-section">
            <h2>Timeline and next steps</h2>
            <table className="print-table">
              <thead><tr><th scope="col">Task</th><th scope="col">Timing</th><th scope="col">Owner and session</th><th scope="col">Status</th></tr></thead>
              <tbody>{activePlan.tasks.map((task) => {
                const conflicts = printScheduleConflicts.get(task.id) ?? [];
                const taskDates = resolveTaskDate(task, submittedBrief.eventDate, submittedBrief.sessions);
                return <tr key={task.id}><th scope="row">{task.title}{task.dependencyIds.length > 0 && <small>Depends on: {task.dependencyIds.map((id) => taskById.get(id)?.title).filter(Boolean).join(", ")}</small>}{task.relativeOffsetDays !== null && <small>Relative target: {taskDates.relativeDate ?? "waiting for anchor date"}{taskDates.fixedDate ? ` · fixed date remains ${taskDates.fixedDate}` : ""}</small>}{conflicts.length > 0 && <small className="print-warning">{conflicts.join(" ")}</small>}</th><td>{taskDates.dueDate || task.timing}</td><td>{task.ownerLabel} · {sessionScopeLabel(submittedBrief.sessions, task.sessionId)}</td><td>{task.status.replaceAll("_", " ")}</td></tr>;
              })}</tbody>
            </table>
          </section>

          <section className="print-section">
            <h2>Cost register</h2>
            <ul className="print-cost-list">{activePlan.budget.items.map((cost) => {
              const expectedGuests = expectedGuestsForCostItem(activePlan, cost);
              const forecast = forecastCostItem(cost, expectedGuests);
              const forecastText = forecast.lowerMinor === null
                ? "Unknown until a price is recorded"
                : moneyRange(forecast.lowerMinor, forecast.upperMinor ?? forecast.lowerMinor, currency);
              const outstanding = cost.evidence === "committed" && forecast.lowerMinor !== null
                ? Math.max(0, forecast.lowerMinor - cost.paidMinor)
                : null;
              const quoteValidity = quoteValidityMessage(cost, quoteTodayDate);
              const quoteStatus = quoteValidityStatus(cost, quoteTodayDate);
              return <li key={cost.id}>
                <div className="print-cost-heading"><strong>{cost.label}</strong><span>{CATEGORY_LABELS[cost.category]} · {sessionScopeLabel(submittedBrief.sessions, cost.sessionId)} · {cost.evidence} · {cost.mandatory ? "mandatory" : "optional"}</span></div>
                <p>Forecast: {forecastText}{cost.pricingModel === "per_guest" && forecast.lowerMinor !== null ? ` for ${forecast.units} billed guests` : ""}{cost.paidMinor > 0 ? ` · paid ${formatMoney(cost.paidMinor, currency)}` : ""}{outstanding !== null ? ` · outstanding ${formatMoney(outstanding, currency)}` : ""}</p>
                <p>Fees {cost.feesIncluded === null ? "unknown" : cost.feesIncluded ? "included" : "excluded"} · Taxes {cost.taxesIncluded === null ? "unknown" : cost.taxesIncluded ? "included" : "excluded"} · Charge review {cost.chargesReviewed ? "complete" : "open"}</p>
                {quoteValidity && <p className={quoteStatus === "expired" || quoteStatus === "unknown" ? "print-warning" : undefined}>Quote validity: {quoteValidity}</p>}
                {cost.pricingModel === "per_guest" && <p>Minimum billable guests: {cost.minimumGuestCount ?? "unknown"}</p>}
                <p><strong>Source / note:</strong> {cost.sourceNote || "No source recorded."}</p>
                {cost.exclusions.length > 0 ? <p><strong>Exclusions:</strong> {cost.exclusions.join("; ")}</p> : cost.evidence === "quote" && <p><strong>Exclusions:</strong> not recorded</p>}
                {cost.adjustments.length > 0 && <ul>{cost.adjustments.map((adjustment) => <li key={adjustment.id}>{adjustment.kind}: {adjustment.label} · {formatMoney(adjustment.amountMinor, currency)}{adjustment.pricingModel === "per_guest" ? ` per guest × ${expectedGuests} billed` : " fixed"} · Source: {adjustment.sourceNote}</li>)}</ul>}
              </li>;
            })}</ul>
          </section>

          <section className="print-section">
            <h2>Ideas that fit</h2>
            <ul className="print-idea-list">{proposal.ideas.map((idea, index) => <li key={`${index}-${idea.title}`}><strong>{idea.title}</strong><p>{idea.whyItFits}</p><small>{idea.costNote}</small></li>)}</ul>
          </section>

          <section className="print-section">
            <h2>Vendor checklist</h2>
            {activePlan.vendors.map((vendor) => <div className="print-vendor" key={vendor.id}>
              <h3>{vendor.category}{vendor.name ? ` · ${vendor.name}` : ""}</h3>
              <p>Availability: {vendor.availability.replaceAll("_", " ")} · Booking: {vendor.booking.replaceAll("_", " ")}</p>
              <ul>{vendor.questions.map((question, index) => <li key={index}>{question}</li>)}</ul>
              {vendor.notes && <p><strong>Host note:</strong> {vendor.notes}</p>}
            </div>)}
            <p className="print-note">No vendor availability or booking is confirmed unless the host recorded it above.</p>
          </section>

          <section className="print-section">
            <h2>Open questions and assumptions</h2>
            <div className="print-question-columns">
              <div><h3>Worth deciding</h3><ul>{proposal.openQuestions.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
              <div><h3>Currently assumed</h3><ul>{proposal.assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
            </div>
          </section>
          <footer className="print-document-footer">Private planning copy · Verify prices, availability, accessibility arrangements, and local requirements before booking.</footer>
        </article>
        <footer className="page-footer"><span>Mehfiloom <span className="brand-dot">·</span> Weave your perfect celebration.</span><span>Thoughtful plans start with your people.</span></footer>
      </main>
    </div>
  );
}

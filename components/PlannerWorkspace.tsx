"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Flower2,
  MapPin,
  Plus,
  Printer,
  Sparkles,
  Store,
  Trash2,
  Upload,
  UsersRound,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  BUDGET_CATEGORIES,
  CATEGORY_LABELS,
  EVENT_TYPES,
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
  canAddTaskDependency,
  canMarkTaskDone,
  canReopenTask,
  calculateBudgetHealth,
  createSavedPlan,
  createWorkspace,
  expectedGuestsForCostItem,
  forecastCostItem,
  makeId,
  parsePlanDocument,
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
import { acceptPlanRevision, diffPlanRevision, restorePreviousPlanRevision, type PendingPlanRevision } from "@/lib/plan-revisions";
import { PaymentHistoryPanel, type PaymentDraft } from "./PaymentHistoryPanel";
import { CostAdjustmentsEditor, type CostAdjustmentDraft } from "./CostAdjustmentsEditor";

const EVENT_LABELS: Record<EventType, string> = {
  wedding: "Wedding",
  birthday: "Birthday",
  community: "Community event",
};

const EVENT_MARKS: Record<EventType, string> = {
  wedding: "W",
  birthday: "B",
  community: "C",
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

const EVENT_STYLE_PROMPTS: Record<EventType, { label: string; placeholder: string; mustHaves: string }> = {
  wedding: {
    label: "What should it feel like?",
    placeholder: "A relaxed garden celebration with traditions we choose together…",
    mustHaves: "Accessibility, dietary needs, traditions you have chosen, and a weather backup…",
  },
  birthday: {
    label: "Who is the day for, and what do they enjoy?",
    placeholder: "A hands-on activity party, with a quieter spot to take a break…",
    mustHaves: "Food allergies to confirm with parents, clear routes, supervision, or a quieter space…",
  },
  community: {
    label: "What is the purpose and feel of the gathering?",
    placeholder: "A neighbor-led evening to share food, stories, and local ideas…",
    mustHaves: "Step-free routes, language access, volunteer roles, sanitation, and a weather backup…",
  },
};

export default function PlannerWorkspace({ initialEventType }: { initialEventType: EventType }) {
  const [workspace, setWorkspace] = useState<Workspace>(() => createWorkspace(makeSeedPlan(initialEventType)));
  const [storageReady, setStorageReady] = useState(false);
  const [storageLoadFailed, setStorageLoadFailed] = useState(false);
  const [storageLoadAttempt, setStorageLoadAttempt] = useState(0);
  const [todayDate, setTodayDate] = useState("");
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
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!error || !errorTargetId) return;
    document.getElementById(errorTargetId)?.focus();
  }, [error, errorTargetId]);

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
  const completeCount = activePlan.tasks.filter((task) => task.status === "done").length;
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
        body: JSON.stringify(isRevision ? { brief: parsedBrief.data, revisionRequest: requestedChange } : parsedBrief.data),
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
    setPendingRevision(null);
    setRevisionRequest("");
    setRevisionFeedback({ tone: "success", message: "Revision discarded. Your current plan remains unchanged." });
  }

  function restoreRevision() {
    try {
      const restoredPlan = restorePreviousPlanRevision(activePlan);
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

  async function importPlan(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
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
        updateCost(cost.id, (current) => ({ ...current, amountMinor, chargesReviewed: false, evidence: current.evidence === "unpriced" ? "estimate" : current.evidence }));
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
        <Link className="brand" href="/" aria-label="Mehfiloom home">
          <span className="brand-mark" aria-hidden="true">m</span>
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
            <button type="button" onClick={exportPlan}><ArrowDownToLine size={15} /> Export JSON</button>
            <button type="button" onClick={() => importInput.current?.click()}><Upload size={15} /> Import JSON</button>
            <button type="button" onClick={() => window.print()}><Printer size={15} /> Print plan</button>
            <input ref={importInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={importPlan} aria-label="Choose a Mehfiloom plan JSON file" />
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
          <aside className="brief-card">
            <div className="card-kicker"><span className="step-number">01</span> YOUR EVENT BRIEF</div>
            <div className="brief-heading-row">
              <div><h2>Start with the feeling.</h2><p className="card-intro">A few details help us make the ideas personal and practical.</p></div>
              <button className="text-button" type="button" onClick={loadExample} title="Restore the clearly labeled example brief"><WandSparkles size={15} /> Use example</button>
            </div>
            <form onSubmit={generate} noValidate>
              <fieldset className="event-type-fieldset" id="event-type-options" tabIndex={-1} aria-describedby={errorTargetId === "event-type-options" ? "brief-error" : undefined}>
                <legend>What are you planning?</legend>
                <div className="event-type-grid">{EVENT_TYPES.map((type) => <button type="button" key={type} className={`event-type-option ${brief.eventType === type ? "selected" : ""}`} aria-pressed={brief.eventType === type} onClick={() => updateBrief("eventType", type)}><span className={`event-type-mark mark-${type}`}>{EVENT_MARKS[type]}</span><span>{EVENT_LABELS[type]}</span></button>)}</div>
              </fieldset>
              <div className="form-grid">
                <label className="field field-full"><span>Event name</span><input id="event-name" value={brief.eventName} onChange={(e) => updateBrief("eventName", e.target.value)} maxLength={80} required aria-invalid={errorTargetId === "event-name" || undefined} aria-describedby={errorTargetId === "event-name" ? "brief-error" : undefined} /></label>
                <label className="field"><span>Where</span><span className="input-with-icon"><MapPin size={16} /><input id="event-location" value={brief.location} onChange={(e) => updateBrief("location", e.target.value)} maxLength={100} required aria-invalid={errorTargetId === "event-location" || undefined} aria-describedby={errorTargetId === "event-location" ? "brief-error" : undefined} /></span></label>
                <label className="field"><span>Event date <small>optional</small></span><span className="input-with-icon"><CalendarDays size={16} /><input id="event-date" type="date" value={brief.eventDate} onInput={(event) => updateBrief("eventDate", event.currentTarget.value)} aria-invalid={errorTargetId === "event-date" || undefined} aria-describedby={errorTargetId === "event-date" ? "brief-error" : undefined} /></span></label>
                <label className="field"><span>Event time zone <small>optional until time is known</small></span><input id="event-timezone" list="iana-time-zones" value={brief.timeZone ?? ""} onChange={(event) => updateBrief("timeZone", event.target.value.trim() || null)} placeholder="Asia/Kolkata" aria-invalid={errorTargetId === "event-timezone" || undefined} aria-describedby={errorTargetId === "event-timezone" ? "timezone-help brief-error" : "timezone-help"} /><small id="timezone-help" className="field-hint">Use an IANA name. Calendar dates stay as entered; local times use this zone, never the computer’s time zone.</small></label>
                <div className="field"><label htmlFor="event-time"><span>Local event start time <small>optional</small></span><input id="event-time" type="text" inputMode="numeric" maxLength={5} value={brief.eventTime} onChange={(event) => updateBrief("eventTime", event.currentTarget.value)} placeholder="e.g. 18:30" aria-invalid={errorTargetId === "event-time" || undefined} aria-describedby={errorTargetId === "event-time" ? "event-time-help brief-error" : "event-time-help"} /></label>
                  {eventTimeResolution.status === "ambiguous" && <label className="time-occurrence-choice">This time occurs twice<select aria-label="Choose which repeated event time" value={brief.eventTimeOccurrence ?? ""} onChange={(event) => updateBrief("eventTimeOccurrence", event.target.value === "" ? null : event.target.value as "earlier" | "later")}><option value="">Choose occurrence</option><option value="earlier">Earlier occurrence</option><option value="later">Later occurrence</option></select></label>}
                  <small id="event-time-help" className="field-hint">{eventTimeDisplay ? `Resolves to ${eventTimeDisplay}.` : eventTimeResolution.status === "nonexistent" ? "This local time does not exist because clocks move forward." : eventTimeResolution.status === "ambiguous" ? "Choose the earlier or later occurrence of this repeated local time." : brief.eventTime ? "Set the date and IANA time zone to resolve this local time." : "Enter a local time only when you know the event’s time zone."}</small>
                </div>
                <datalist id="iana-time-zones">{["UTC", "Asia/Kolkata", "Asia/Dubai", "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Australia/Sydney"].map((zone) => <option key={zone} value={zone} />)}</datalist>
                <label className="field"><span>Unique guests across the event</span><span className="input-with-icon"><UsersRound size={16} /><input id="guest-count" type="number" min={1} max={10000} step={1} value={brief.guestCount} onChange={(e) => updateBrief("guestCount", Number(e.target.value))} required aria-invalid={errorTargetId === "guest-count" || undefined} aria-describedby={errorTargetId === "guest-count" ? "brief-error" : undefined} /></span><small className="field-hint">An overall estimate. People may attend more than one session, so these counts are not added together.</small></label>
                <div className="field-full session-builder" role="group" aria-labelledby="session-builder-title">
                  <div className="session-builder-heading"><span id="session-builder-title" tabIndex={errorTargetId === "session-builder-title" ? -1 : undefined} aria-describedby={errorTargetId === "session-builder-title" ? "brief-error" : undefined}>Functions or sessions <small>optional</small></span><button className="text-button" type="button" disabled={brief.sessions.length >= 12} onClick={() => updateBrief("sessions", [...brief.sessions, { id: makeId(), name: "", date: "", startTime: "", startTimeOccurrence: null, guestCount: brief.guestCount }])}><Plus size={14} /> Add a session</button></div>
                  <p className="field-hint">Use this for separate wedding functions, birthday activities, or community-event time blocks. Enter only the guests expected at each one. Each local start time uses the event time zone above.</p>
                  {brief.sessions.map((session, index) => <div className="session-row" key={session.id}>
                    <label>Session name<input id={`session-${session.id}-name`} value={session.name} onChange={(event) => updateBrief("sessions", brief.sessions.map((item) => item.id === session.id ? { ...item, name: event.target.value } : item))} maxLength={80} placeholder={`Session ${index + 1}`} required aria-invalid={errorTargetId === `session-${session.id}-name` || undefined} aria-describedby={errorTargetId === `session-${session.id}-name` ? "brief-error" : undefined} /></label>
                    <div className="session-date-time">
                      <label>Date <small>optional</small><input id={`session-${session.id}-date`} type="date" value={session.date} onInput={(event) => updateBrief("sessions", brief.sessions.map((item) => item.id === session.id ? { ...item, date: event.currentTarget.value, startTimeOccurrence: null } : item))} aria-invalid={errorTargetId === `session-${session.id}-date` || undefined} aria-describedby={errorTargetId === `session-${session.id}-date` ? "brief-error" : undefined} /></label>
                      <label>Local start time <small>optional</small><input id={`session-${session.id}-time`} type="text" inputMode="numeric" maxLength={5} placeholder="e.g. 18:30" value={session.startTime} onChange={(event) => updateBrief("sessions", brief.sessions.map((item) => item.id === session.id ? { ...item, startTime: event.currentTarget.value, startTimeOccurrence: null } : item))} aria-invalid={errorTargetId === `session-${session.id}-time` || undefined} aria-describedby={errorTargetId === `session-${session.id}-time` ? "brief-error" : undefined} />
                        {sessionTimeResolutions.get(session.id)?.status === "ambiguous" && <select aria-label={`Choose which repeated start time for ${session.name || `session ${index + 1}`}`} value={session.startTimeOccurrence ?? ""} onChange={(event) => updateBrief("sessions", brief.sessions.map((item) => item.id === session.id ? { ...item, startTimeOccurrence: event.target.value === "" ? null : event.target.value as "earlier" | "later" } : item))}><option value="">Choose occurrence</option><option value="earlier">Earlier occurrence</option><option value="later">Later occurrence</option></select>}
                        {formatZonedInstant(sessionTimeResolutions.get(session.id)?.instant ?? null, brief.timeZone) && <small className="field-hint">{formatZonedInstant(sessionTimeResolutions.get(session.id)?.instant ?? null, brief.timeZone)}</small>}
                      </label>
                    </div>
                    <label>Expected guests<input id={`session-${session.id}-guests`} type="number" min={1} max={10000} step={1} value={session.guestCount} onChange={(event) => updateBrief("sessions", brief.sessions.map((item) => item.id === session.id ? { ...item, guestCount: Number(event.target.value) } : item))} required aria-invalid={errorTargetId === `session-${session.id}-guests` || undefined} aria-describedby={errorTargetId === `session-${session.id}-guests` ? "brief-error" : undefined} /></label>
                    <button className="icon-button session-remove" type="button" aria-label={`Remove ${session.name || `session ${index + 1}`}`} onClick={() => updateBrief("sessions", brief.sessions.filter((item) => item.id !== session.id))}><Trash2 size={15} /></button>
                  </div>)}
                </div>
                <label className="field"><span>Currency code</span><input id="event-currency" className="currency-input" value={brief.currency} onChange={(e) => updateBrief("currency", e.target.value.toUpperCase())} maxLength={3} placeholder="INR" autoCapitalize="characters" required aria-invalid={errorTargetId === "event-currency" || undefined} aria-describedby={errorTargetId === "event-currency" ? "brief-error" : undefined} /></label>
                <label className="field field-full"><span>Total budget</span><span className="input-with-icon money-input"><span className="currency-prefix" aria-hidden="true">{brief.currency || "¤"}</span><input id="budget-amount" inputMode="decimal" value={brief.budgetAmount} onChange={(e) => updateBrief("budgetAmount", e.target.value)} placeholder="250000" required aria-invalid={errorTargetId === "budget-amount" || undefined} aria-describedby={errorTargetId === "budget-amount" ? "budget-help brief-error" : "budget-help"} /></span><small id="budget-help" className="field-hint">Planning cap in the selected currency. Use a period for decimals.</small></label>
                <label className="field field-full"><span>{EVENT_STYLE_PROMPTS[brief.eventType].label}</span><textarea id="event-style" value={brief.style} onChange={(e) => updateBrief("style", e.target.value)} rows={3} maxLength={500} placeholder={EVENT_STYLE_PROMPTS[brief.eventType].placeholder} aria-invalid={errorTargetId === "event-style" || undefined} aria-describedby={errorTargetId === "event-style" ? "brief-error" : undefined} /></label>
                <label className="field field-full"><span>Must-haves &amp; access needs</span><textarea id="event-must-haves" value={brief.mustHaves} onChange={(e) => updateBrief("mustHaves", e.target.value)} rows={3} maxLength={700} placeholder={EVENT_STYLE_PROMPTS[brief.eventType].mustHaves} aria-invalid={errorTargetId === "event-must-haves" || undefined} aria-describedby={errorTargetId === "event-must-haves" ? "brief-error" : undefined} /><small className="field-hint">We keep these visible in the draft instead of treating them as optional ideas.</small></label>
                {activePlan.origin === "ai" && <label className="field field-full revision-request-field"><span>What changed since this draft?</span><textarea id="revision-request" value={revisionRequest} onChange={(event) => setRevisionRequest(event.target.value)} rows={3} minLength={8} maxLength={500} required placeholder="For example: we expect fewer guests, want a quieter welcome, and need to keep the venue accessible." aria-invalid={errorTargetId === "revision-request" || undefined} aria-describedby={errorTargetId === "revision-request" ? "brief-error" : undefined} /><small className="field-hint">Your new proposal will be reviewed separately. The current plan stays in place until you accept it.</small></label>}
              </div>
              {error && <div id="brief-error" className="form-error" role="alert"><CircleAlert size={17} /><span>{error}</span></div>}
              <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{generationAnnouncement}</p>
              <button className="generate-button" type="submit" aria-busy={generating} disabled={generating || pendingRevision !== null}>{generating ? <span className="button-spinner" aria-hidden="true" /> : <Sparkles size={17} />}{" "}<span>{generating ? activePlan.origin === "ai" ? "Drafting your revision…" : "Weaving your first draft…" : activePlan.origin === "ai" ? "Review a revision" : "Create my plan"}</span>{!generating && <ArrowRight size={17} />}</button>
              <p className="privacy-note"><span className="privacy-dot" /> Live planning sends your event brief and any revision request to Groq. Groq says inference data is not retained by default, but may be logged for up to 30 days for reliability or abuse monitoring. Use fictional details and avoid real guest names or sensitive information. <a href="https://console.groq.com/docs/your-data" target="_blank" rel="noreferrer">Groq data policy</a>.</p>
            </form>
          </aside>

          <section className="plan-card" aria-labelledby="plan-heading">
            <div className="plan-header"><div><div className="card-kicker"><span className="step-number step-two">02</span> YOUR PLANNING CANVAS</div><div className="plan-title-row"><h2 id="plan-heading">A plan taking shape</h2><span className={`origin-badge ${activePlan.origin === "ai" ? "origin-ai" : "origin-example"}`}><span className="badge-dot" /> {activePlan.origin === "ai" ? "AI draft · review needed" : "Example plan · synthetic"}</span></div><p className="plan-subtitle">A working canvas for your ideas, budget, and next steps.</p></div><button className={`edit-button ${editing ? "is-editing" : ""}`} type="button" onClick={() => setEditing((value) => !value)}>{editing ? <Check size={15} /> : <ClipboardList size={15} />}{editing ? "Done editing" : "Edit draft"}</button></div>
            {briefChanged && <div className="stale-notice"><CircleAlert size={16} /> The brief has changed since this draft was made. Generate again to refresh its suggestions.</div>}
            {revisionFeedback && <div className={`revision-feedback revision-feedback-${revisionFeedback.tone}`} role={revisionFeedback.tone === "error" ? "alert" : "status"}>{revisionFeedback.message}</div>}
            {activePlan.undoRevision && <div className="revision-restore"><div><strong>Recent change</strong><span>{canRestoreRevision ? "You can restore the state from just before the last accepted revision." : "This plan has changed since that revision. The earlier state is kept, but restoring it now could remove newer work."}</span></div>{canRestoreRevision && <button className="revision-discard-button" type="button" onClick={restoreRevision}>Restore previous state</button>}</div>}
            {pendingRevision && <section className="revision-review" aria-labelledby="revision-review-title">
              <div className="revision-review-heading"><div><span className="section-label">REVIEW BEFORE APPLYING</span><h3 id="revision-review-title">Revision {pendingRevision.basePlan.revisionNumber + 1}</h3></div><span className="revision-version">v{pendingRevision.basePlan.revisionNumber} → v{pendingRevision.basePlan.revisionNumber + 1}</span></div>
              <p className="revision-request-summary"><strong>Your request</strong> {pendingRevision.request}</p>
              <ul className="revision-change-list">{pendingRevision.changes.map((change) => <li key={change.title}><strong>{change.title}</strong><span>{change.detail}</span></li>)}</ul>
              <p className="revision-preservation-note">Accepting recalculates the budget from the new brief and resets the review if its cap, allocation, or cost lines change. Recorded costs, payments, guest counts, task progress, vendor notes, and host-edited title, overview, or theme are carried forward.</p>
              {pendingRevisionIsStale && <div className="form-error" role="alert"><CircleAlert size={16} /><span>This plan changed while the revision was being drafted. Discard the stale draft and request a fresh revision.</span></div>}
              <div className="revision-actions"><button className="revision-accept-button" type="button" onClick={acceptRevision} disabled={pendingRevisionIsStale}>Accept revision</button><button className="revision-discard-button" type="button" onClick={discardRevision}>Discard revision</button></div>
            </section>}
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
            <div className="budget-surface"><div className="budget-topline"><span><CircleCheck size={16} /> Allocation adds up to your cap</span><small>Planning targets · not vendor quotes</small></div><div className="budget-grid">{plan.lines.map((line, index) => { const percentage = Math.max(0, Math.min(100, (line.amountMinor / Math.max(budgetTotal, 1)) * 100)); const category = BUDGET_CATEGORIES.find((item) => item === line.category); return <div className="budget-line" key={`${line.category}-${index}`}><div className="budget-line-head"><span>{category ? CATEGORY_LABELS[category] : line.category}</span><strong>{formatMoney(line.amountMinor, plan.currency)}</strong></div><div className="budget-track"><span className={`budget-fill fill-${index % 5}`} style={{ width: `${percentage}%` }} /></div><p>{line.rationale}</p></div>; })}</div><div className="budget-footnote">The split comes from relative priorities and exact arithmetic. Local costs, tax, and vendor availability still need checking.</div></div>

            <div className="section-heading timeline-heading"><div><span className="section-label">SMALL STEPS, GOOD MOMENTUM</span><h3>Your next steps <span className="task-count">{completeCount}/{activePlan.tasks.length} done</span></h3><p className="card-intro">Suggested timing is a starting point. Relative dates preview against the current brief and move with event or function dates; fixed due dates stay as entered.</p></div><span className="heading-icon"><CalendarDays size={18} /></span></div>
            <div className="timeline-list">
              {activePlan.tasks.map((task, index) => {
                const taskDates = resolveTaskDate(task, brief.eventDate, brief.sessions);
                const dependencyTasks = task.dependencyIds
                  .map((dependencyId) => taskById.get(dependencyId))
                  .filter((dependency): dependency is TaskRecord => dependency !== undefined);
                const unmetDependencyTasks = dependencyTasks.filter((dependency) => dependency.status !== "done");
                const completedDependents = activePlan.tasks.filter((candidate) => candidate.status === "done" && candidate.dependencyIds.includes(task.id));
                const blocked = task.status !== "done" && !canMarkTaskDone(task, activePlan.tasks);
                const completedBeforePrerequisites = task.status === "done" && unmetDependencyTasks.length > 0;
                const cannotReopen = task.status === "done" && !canReopenTask(task, activePlan.tasks);

                return (
                  <div className={`timeline-item ${task.status === "done" ? "task-done" : ""}`} key={task.id}>
                    <button
                      className="task-check"
                      type="button"
                      aria-label={blocked
                        ? `Complete prerequisite tasks before marking complete: ${unmetDependencyTasks.map((dependency) => dependency.title).join(", ")}`
                        : cannotReopen
                          ? `Mark dependent tasks incomplete first: ${completedDependents.map((dependent) => dependent.title).join(", ")}`
                          : completedBeforePrerequisites
                            ? `Mark incomplete; prerequisites are unfinished: ${unmetDependencyTasks.map((dependency) => dependency.title).join(", ")}`
                            : `${task.status === "done" ? "Mark incomplete" : "Mark complete"}: ${task.title}`}
                      aria-pressed={task.status === "done"}
                      disabled={blocked || cannotReopen}
                      onClick={() => updateTask(task.id, (current) => ({ ...current, status: current.status === "done" ? "todo" : "done" }))}
                    >
                      {task.status === "done" && <Check size={13} />}
                    </button>
                    <div className="timeline-copy">
                      {editing ? <>
                        <input aria-label={`Task ${index + 1}`} value={task.title} onChange={(event) => updateTask(task.id, (current) => ({ ...current, title: event.target.value }))} maxLength={120} />
                        <input aria-label={`Task ${index + 1} timing`} value={task.timing} onChange={(event) => updateTask(task.id, (current) => ({ ...current, timing: event.target.value }))} maxLength={80} />
                        <div className="task-meta-edit">
                          <label>Owner<input aria-label={`Task ${index + 1} owner`} value={task.ownerLabel} onChange={(event) => updateTask(task.id, (current) => ({ ...current, ownerLabel: event.target.value }))} maxLength={80} /></label>
                          <label>Fixed due date<input aria-label={`Task ${index + 1} fixed due date`} type="date" value={task.dueDate ?? ""} onInput={(event) => { const dueDate = event.currentTarget.value || null; updateTask(task.id, (current) => ({ ...current, dueDate })); }} /><small>Kept as entered, even if the event date changes.</small></label>
                          <label>Relative offset in calendar days<input aria-label={`Task ${index + 1} relative offset in calendar days`} type="number" min={-3650} max={3650} step={1} value={task.relativeOffsetDays ?? ""} onInput={(event) => { const value = event.currentTarget.value; updateTask(task.id, (current) => ({ ...current, relativeOffsetDays: value === "" ? null : Number(value) })); }} /><small>{taskDates.relativeDate ? `Target ${taskDates.relativeDate} from ${task.sessionId ? "function" : "event"} date ${taskDates.anchorDate}.` : `Negative is before; positive is after. Anchored to the ${task.sessionId ? "assigned function" : "event"} date.`}</small></label>
                          <label>Session / function<select aria-label={`Task ${index + 1} session`} value={task.sessionId ?? ""} onChange={(event) => updateTask(task.id, (current) => ({ ...current, sessionId: event.target.value || null }))}><option value="">Shared / whole event</option>{submittedBrief.sessions.map((session) => <option value={session.id} key={session.id}>{session.name}</option>)}</select></label>
                        </div>
                        <fieldset className="task-dependency-edit">
                          <legend>Depends on</legend>
                          {activePlan.tasks.filter((candidate) => candidate.id !== task.id).map((candidate) => {
                            const checked = task.dependencyIds.includes(candidate.id);
                            const maySelect = checked || (
                              canAddTaskDependency(activePlan.tasks, task.id, candidate.id)
                              && (task.status !== "done" || candidate.status === "done")
                            );
                            return (
                              <label key={candidate.id} title={!maySelect && task.status === "done" ? "Mark this task incomplete before adding an unfinished prerequisite." : undefined}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!maySelect}
                                  onChange={(event) => updateTask(task.id, (current) => ({
                                    ...current,
                                    dependencyIds: event.target.checked
                                      ? [...current.dependencyIds, candidate.id]
                                      : current.dependencyIds.filter((dependencyId) => dependencyId !== candidate.id),
                                  }))}
                                />
                                <span>{candidate.title}{candidate.status === "done" ? " · done" : ""}</span>
                              </label>
                            );
                          })}
                          <small>Complete prerequisites before this task. Choices that create a cycle or add an unfinished prerequisite to a completed task are unavailable.</small>
                        </fieldset>
                      </> : <>
                        <strong>{task.title}</strong>
                        <span><CalendarDays size={13} />{taskDates.dueDate || task.timing} · {task.ownerLabel} · {sessionScopeLabel(brief.sessions, task.sessionId)}</span>
                        {task.relativeOffsetDays !== null && <small className="task-date-note">Relative target: {taskDates.relativeDate ?? "waiting for its anchor date"}{taskDates.fixedDate ? ` · fixed date stays ${taskDates.fixedDate}` : " · no fixed date"}</small>}
                        {dependencyTasks.length > 0 && <span className="task-dependency-summary">Depends on: {dependencyTasks.map((dependency) => dependency.title).join(", ")}</span>}
                      </>}
                      {blocked && <span className="task-blocked">Waiting on: {unmetDependencyTasks.map((dependency) => dependency.title).join(", ")}</span>}
                      {completedBeforePrerequisites && <span className="task-blocked">Marked complete before prerequisites: {unmetDependencyTasks.map((dependency) => dependency.title).join(", ")}</span>}
                      {cannotReopen && <span className="task-blocked">Mark incomplete first: {completedDependents.map((dependent) => dependent.title).join(", ")}</span>}
                      {scheduleConflicts.get(task.id)?.map((conflict) => <span className="task-schedule-warning" key={conflict}>Schedule check: {conflict}</span>)}
                    </div>
                    <span className={`priority priority-${task.priority}`}>{task.priority}</span>
                  </div>
                );
              })}
            </div>

            <section className="costs-section" aria-labelledby="cost-heading"><div className="section-heading compact-heading"><div><span className="section-label">KNOWN, QUOTED &amp; STILL TO CHECK</span><h3 id="cost-heading">Cost register</h3></div><span className="soft-icon"><CircleCheck size={16} /></span></div>
              {budgetHealth ? <div className={`budget-health health-${budgetHealth.state}`}><div><strong>{budgetHealth.state === "within_cap" ? "Recorded costs plus reserve fit the cap" : budgetHealth.state === "over_cap" ? "Recorded costs plus reserve exceed the cap" : budgetHealth.state === "range_crosses_cap" ? "Cost range crosses the cap" : activePlan.budget.reviewComplete ? "Review mandatory costs and fees" : "Budget review is still open"}</strong><small>{budgetHealth.unresolvedCount} unpriced · {budgetHealth.unresolvedMandatoryCount} mandatory and unpriced · {budgetHealth.unresolvedMandatoryChargeCount} mandatory fee/tax reviews unresolved</small></div><div className="health-number">{moneyRange(budgetHealth.forecastWithReserveMinor, budgetHealth.forecastWithReserveMaxMinor, currency)}<small>forecast including reserve</small></div></div> : <div className="budget-health health-unknown"><strong>Fix invalid plan fields to recalculate the budget.</strong></div>}
              {budgetHealth && budgetHealth.state === "over_cap" && <div className="form-error" role="alert"><CircleAlert size={16} /><span>This recorded forecast is above the cap. Reduce costs or revise the cap before treating the plan as feasible.</span></div>}
              {budgetHealth?.state === "range_crosses_cap" && <div className="form-error" role="alert"><CircleAlert size={16} /><span>The upper forecast exceeds the cap; this range cannot be treated as affordable.</span></div>}
              <div className="cost-rollup"><span>Cap <strong>{formatMoney(activePlan.budget.capMinor, currency)}</strong></span><span>Known costs <strong>{moneyRange(budgetHealth?.knownCostsMinor ?? 0, budgetHealth?.knownCostsMaxMinor ?? 0, currency)}</strong></span><span>Reserve <strong>{formatMoney(budgetHealth?.reserveMinor ?? 0, currency)}</strong></span><span>Paid <strong>{formatMoney(budgetHealth?.paidMinor ?? 0, currency)}</strong></span><span>Committed outstanding <strong>{formatMoney(budgetHealth?.outstandingCommittedMinor ?? 0, currency)}</strong></span></div>
              <div className="cost-list">{activePlan.budget.items.map((cost) => <article className="cost-item" key={cost.id}><div className="cost-item-head"><div><strong>{cost.label}</strong><small>{CATEGORY_LABELS[cost.category]} · {sessionScopeLabel(submittedBrief.sessions, cost.sessionId)} · {costEvidenceSummary(cost, currency, expectedGuestsForCostItem(activePlan, cost))}</small></div>{editing && <button className="icon-button" type="button" onClick={() => removeCost(cost.id)} aria-label={`Remove ${cost.label}`}><Trash2 size={15} /></button>}</div>
                {editing ? <div className="cost-edit-grid"><label>Line label<input value={cost.label} maxLength={100} onChange={(event) => updateCost(cost.id, (current) => ({ ...current, label: event.target.value }))} /></label><label>Category<select value={cost.category} onChange={(event) => updateCost(cost.id, (current) => ({ ...current, category: event.target.value as CostItem["category"] }))}>{BUDGET_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}</select></label><label>Applies to<select value={cost.sessionId ?? ""} onChange={(event) => { const sessionId = event.target.value || null; updateCostProjection(cost, { sessionId }, "This session has a smaller commitment total than the amount already paid."); }}><option value="">Shared / whole event</option>{submittedBrief.sessions.map((session) => <option value={session.id} key={session.id}>{session.name}</option>)}</select></label><label>Price basis<select value={cost.pricingModel} onChange={(event) => { const pricingModel = event.target.value as CostItem["pricingModel"]; updateCostProjection(cost, { pricingModel }, "The new price basis would put paid amount above the commitment."); }}><option value="fixed">Fixed total</option><option value="per_guest">Per guest</option></select></label><label>{cost.pricingModel === "per_guest" ? "Rate per guest (" + currency + ")" : "Lower amount (" + currency + ")"}<input inputMode="decimal" value={amountDrafts[cost.id] ?? amountInput(cost.amountMinor, currency)} placeholder="Unknown" onChange={(event) => setAmountDrafts((current) => ({ ...current, [cost.id]: event.target.value }))} onBlur={(event) => updateAmountOnBlur(cost, event.target.value)} /></label><label>Upper amount / rate ({currency})<input inputMode="decimal" value={amountDrafts[cost.id + ":max"] ?? amountInput(cost.amountMaxMinor, currency)} placeholder="Same as lower" disabled={cost.evidence === "committed"} onChange={(event) => setAmountDrafts((current) => ({ ...current, [cost.id + ":max"]: event.target.value }))} onBlur={(event) => updateMaxAmountOnBlur(cost, event.target.value)} /></label><label>Evidence<select value={cost.evidence} onChange={(event) => { const evidence = event.target.value as CostItem["evidence"]; if (evidence !== "committed" && cost.payments.length > 0) { setCostMessage("Remove recorded payments before changing this cost from committed."); return; } if (evidence !== "unpriced" && cost.amountMinor === null) { setCostMessage("Enter an amount before marking this cost as an estimate, quote, or commitment."); return; } if (evidence === "committed" && cost.amountMaxMinor !== null && cost.amountMaxMinor !== cost.amountMinor) { setCostMessage("Clear the upper amount before recording an exact commitment."); return; } if (evidence === "committed" && cost.adjustments.some((adjustment) => adjustment.amountMaxMinor !== null && adjustment.amountMaxMinor !== adjustment.amountMinor)) { setCostMessage("Use exact sourced adjustment amounts before recording a commitment."); return; } setCostMessage(""); updateCost(cost.id, (current) => ({ ...current, evidence, chargesReviewed: false, ...(evidence === "unpriced" ? { amountMinor: null, amountMaxMinor: null, paidMinor: 0 } : {}) })); }}><option value="unpriced">Unpriced</option><option value="estimate">Estimate</option><option value="quote">Quote</option><option value="committed">Committed</option></select></label><label className="checkbox-field"><input type="checkbox" checked={cost.mandatory} onChange={(event) => updateCost(cost.id, (current) => ({ ...current, mandatory: event.target.checked }))} /> Mandatory to the event</label><label>Quote valid until<input type="date" value={cost.validUntil ?? ""} onChange={(event) => updateCost(cost.id, (current) => ({ ...current, validUntil: event.target.value || null }))} /></label><label>Minimum guests<input type="number" min={1} max={10000} value={cost.minimumGuestCount ?? ""} onChange={(event) => updateCostProjection(cost, { minimumGuestCount: event.target.value ? Number(event.target.value) : null }, "The minimum guest count would put paid amount above the commitment.")} /></label><label className="field-wide">Source / exclusion notes<textarea value={cost.sourceNote} maxLength={300} onChange={(event) => updateCost(cost.id, (current) => ({ ...current, sourceNote: event.target.value, chargesReviewed: false }))} placeholder="Who provided this and what is excluded?" /></label></div> : <div className="cost-evidence"><span>{cost.sourceNote || "No source recorded."}</span>{cost.validUntil && <small>Valid until {cost.validUntil}</small>}{cost.minimumGuestCount && <small>Minimum guests: {cost.minimumGuestCount}</small>}</div>}<CostAdjustmentsEditor cost={cost} expectedGuests={expectedGuestsForCostItem(activePlan, cost)} currency={currency} editing={editing} onSave={(adjustmentId, draft) => saveCostAdjustment(cost.id, adjustmentId, draft)} onRemove={(adjustmentId) => removeCostAdjustment(cost.id, adjustmentId)} onChargeStatus={(field, value) => updateChargeStatus(cost.id, field, value)} onReview={(checked) => updateChargeReview(cost.id, checked)} /><PaymentHistoryPanel cost={cost} currency={currency} editing={editing} draft={paymentDrafts[cost.id] ?? { amount: "", paidAt: "", note: "" }} onDraftChange={(field, value) => updatePaymentDraft(cost.id, field, value)} onAdd={() => addPayment(cost)} onRemove={(paymentId) => removePayment(cost, paymentId)} /></article>)}</div>
              <form className="add-cost-form" onSubmit={addCost}><h4>Add a cost or quote</h4><div className="add-cost-grid"><label>Label<input required minLength={2} maxLength={100} value={costDraft.label} onChange={(event) => setCostDraft((current) => ({ ...current, label: event.target.value }))} placeholder="e.g. Community hall" /></label><label>Category<select value={costDraft.category} onChange={(event) => setCostDraft((current) => ({ ...current, category: event.target.value as CostItem["category"] }))}>{BUDGET_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}</select></label><label>Applies to<select value={costDraft.sessionId ?? ""} onChange={(event) => setCostDraft((current) => ({ ...current, sessionId: event.target.value || null }))}><option value="">Shared / whole event</option>{submittedBrief.sessions.map((session) => <option value={session.id} key={session.id}>{session.name}</option>)}</select></label><label>Price basis<select value={costDraft.pricingModel} onChange={(event) => setCostDraft((current) => ({ ...current, pricingModel: event.target.value as CostItem["pricingModel"] }))}><option value="fixed">Fixed total</option><option value="per_guest">Per guest</option></select></label><label>Evidence<select value={costDraft.evidence} onChange={(event) => { const evidence = event.target.value as CostItem["evidence"]; if (evidence === "committed" && costDraft.maxAmount.trim()) { try { if (parseBudgetMinor(costDraft.maxAmount, currency) !== parseBudgetMinor(costDraft.amount, currency)) throw new Error(); } catch { setCostMessage("Clear the upper amount before choosing an exact commitment."); return; } } setCostMessage(""); setCostDraft((current) => ({ ...current, evidence })); }}><option value="unpriced">Unpriced</option><option value="estimate">Estimate</option><option value="quote">Quote</option><option value="committed">Committed</option></select></label><label>Lower amount / rate ({currency})<input inputMode="decimal" value={costDraft.amount} disabled={costDraft.evidence === "unpriced"} onChange={(event) => setCostDraft((current) => ({ ...current, amount: event.target.value }))} placeholder={costDraft.evidence === "unpriced" ? "No amount yet" : "e.g. 1200"} /></label><label>Upper amount / rate ({currency})<input inputMode="decimal" value={costDraft.maxAmount} disabled={costDraft.evidence === "unpriced" || costDraft.evidence === "committed"} onChange={(event) => setCostDraft((current) => ({ ...current, maxAmount: event.target.value }))} placeholder="Same as lower" /></label><label className="checkbox-field"><input type="checkbox" checked={costDraft.mandatory} onChange={(event) => setCostDraft((current) => ({ ...current, mandatory: event.target.checked }))} /> Mandatory</label><button type="submit"><Plus size={15} /> Add cost</button></div></form>
              <label className="review-checkbox"><input type="checkbox" checked={activePlan.budget.reviewComplete} onChange={(event) => updateActivePlan((current) => ({ ...current, budget: { ...current.budget, reviewComplete: event.target.checked } }))} /> I reviewed the recorded costs and know what remains unknown.</label>
              {costMessage && <div className="form-error cost-form-message" role="status"><CircleAlert size={16} /><span>{costMessage}</span></div>}
            </section>

            <div className="lower-grid"><section className="ideas-section"><div className="section-heading compact-heading"><div><span className="section-label">PERSONAL TOUCHES</span><h3>Ideas that fit</h3></div><span className="soft-icon"><Sparkles size={16} /></span></div><div className="ideas-list">{proposal.ideas.map((idea, index) => <article className="idea-item" key={`${index}-${idea.title}`}><span className={`idea-number idea-number-${index % 3}`}>0{index + 1}</span><div><strong>{idea.title}</strong><p>{idea.whyItFits}</p><small>{idea.costNote}</small></div></article>)}</div></section>
              <section className="vendors-section"><div className="section-heading compact-heading"><div><span className="section-label">ASK BEFORE YOU BOOK</span><h3>Vendor checklist</h3></div><span className="soft-icon"><Store size={16} /></span></div><div className="vendor-list">{activePlan.vendors.map((vendor) => <details className="vendor-accordion" key={vendor.id}><summary><span>{vendor.category}{vendor.name ? ` · ${vendor.name}` : ""}</span><ChevronDown size={15} /></summary><div className="vendor-detail"><ul>{vendor.questions.map((question, questionIndex) => <li key={questionIndex}>{question}</li>)}</ul>{editing ? <div className="vendor-edit-grid"><label>Vendor name<input value={vendor.name ?? ""} maxLength={80} onChange={(event) => updateVendor(vendor.id, (current) => ({ ...current, name: event.target.value || null }))} /></label><label>Availability<select value={vendor.availability} onChange={(event) => updateVendor(vendor.id, (current) => ({ ...current, availability: event.target.value as VendorRecord["availability"], checkedAt: new Date().toISOString() }))}><option value="unknown">Unknown</option><option value="inquiry_pending">Inquiry sent</option><option value="confirmed">Confirmed</option><option value="expired">Expired</option></select></label><label>Booking<select value={vendor.booking} onChange={(event) => updateVendor(vendor.id, (current) => ({ ...current, booking: event.target.value as VendorRecord["booking"] }))}><option value="not_booked">Not booked</option><option value="host_recorded">Host says booked</option><option value="cancelled">Cancelled</option></select></label><label>Notes<textarea value={vendor.notes} maxLength={500} onChange={(event) => updateVendor(vendor.id, (current) => ({ ...current, notes: event.target.value }))} /></label></div> : <div className="vendor-status"><span>Availability: {vendor.availability.replaceAll("_", " ")}</span><span>Booking: {vendor.booking.replaceAll("_", " ")}</span>{vendor.notes && <p>{vendor.notes}</p>}</div>}</div></details>)}</div><p className="vendor-caveat">Checklist categories are ideas to explore. No vendors or availability are confirmed until you record them.</p></section></div>
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
              return <li key={cost.id}>
                <div className="print-cost-heading"><strong>{cost.label}</strong><span>{CATEGORY_LABELS[cost.category]} · {sessionScopeLabel(submittedBrief.sessions, cost.sessionId)} · {cost.evidence} · {cost.mandatory ? "mandatory" : "optional"}</span></div>
                <p>Forecast: {forecastText}{cost.pricingModel === "per_guest" && forecast.lowerMinor !== null ? ` for ${forecast.units} billed guests` : ""}{cost.paidMinor > 0 ? ` · paid ${formatMoney(cost.paidMinor, currency)}` : ""}{outstanding !== null ? ` · outstanding ${formatMoney(outstanding, currency)}` : ""}</p>
                <p>Fees {cost.feesIncluded === null ? "unknown" : cost.feesIncluded ? "included" : "excluded"} · Taxes {cost.taxesIncluded === null ? "unknown" : cost.taxesIncluded ? "included" : "excluded"} · Charge review {cost.chargesReviewed ? "complete" : "open"}</p>
                {cost.sourceNote && <p><strong>Source / note:</strong> {cost.sourceNote}</p>}
                {cost.exclusions.length > 0 && <p><strong>Exclusions:</strong> {cost.exclusions.join("; ")}</p>}
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

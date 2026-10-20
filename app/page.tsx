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
  Sparkles,
  Store,
  Trash2,
  Upload,
  UsersRound,
  WandSparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  BUDGET_CATEGORIES,
  CATEGORY_LABELS,
  EVENT_TYPES,
  EXAMPLE_BRIEF,
  EXAMPLE_PROPOSAL,
  buildPlanResult,
  currencyDigits,
  eventBriefSchema,
  formatMoney,
  parseBudgetMinor,
  type EventBrief,
  type EventType,
  type PlanResult,
  type PlannerProposal,
} from "@/lib/planner";
import {
  MAX_SAVED_PLANS,
  MAX_PLAN_DOCUMENT_BYTES,
  WORKSPACE_STORAGE_KEY,
  calculateBudgetHealth,
  createSavedPlan,
  createWorkspace,
  forecastCostItem,
  makeId,
  parsePlanDocument,
  parseWorkspaceJson,
  reidentifyPlan,
  savedPlanSchema,
  serializePlanDocument,
  serializeWorkspace,
  type CostItem,
  type SavedPlan,
  type TaskRecord,
  type VendorRecord,
  type Workspace,
} from "@/lib/plan-store";

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

const SEED_PLAN = createSavedPlan(
  EXAMPLE_BRIEF,
  EXAMPLE_BRIEF,
  EXAMPLE_PROPOSAL,
  "example-plan",
  "2026-10-20T00:00:00.000Z",
);

function emptyCostDraft() {
  return { label: "", category: "venue" as (typeof BUDGET_CATEGORIES)[number], pricingModel: "fixed" as CostItem["pricingModel"], amount: "", maxAmount: "", evidence: "estimate" as CostItem["evidence"], mandatory: true };
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

function moneyRange(lowerMinor: number, upperMinor: number, currency: string): string {
  return lowerMinor === upperMinor
    ? formatMoney(lowerMinor, currency)
    : `${formatMoney(lowerMinor, currency)}–${formatMoney(upperMinor, currency)}`;
}

function downloadJson(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Home() {
  const [workspace, setWorkspace] = useState<Workspace>(() => createWorkspace(SEED_PLAN));
  const [storageReady, setStorageReady] = useState(false);
  const [storageLoadFailed, setStorageLoadFailed] = useState(false);
  const [storageStatus, setStorageStatus] = useState("Loading this device’s saved plans…");
  const [storageError, setStorageError] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [costDraft, setCostDraft] = useState(emptyCostDraft);
  const [costMessage, setCostMessage] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [paidDrafts, setPaidDrafts] = useState<Record<string, string>>({});
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    async function loadFromDevice() {
      await Promise.resolve();
      try {
        const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
        if (!active) return;
        if (raw) {
          const loaded = parseWorkspaceJson(raw);
          setWorkspace(loaded);
          setStorageStatus("Saved on this device");
        } else {
          setStorageStatus("New local workspace");
        }
      } catch (loadError) {
        if (!active) return;
        setStorageLoadFailed(true);
        setStorageError(loadError instanceof Error ? loadError.message : "Could not read this device’s saved plans.");
        setStorageStatus("Saved plans need attention");
      } finally {
        if (active) setStorageReady(true);
      }
    }
    void loadFromDevice();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storageReady || storageLoadFailed) return;
    let active = true;
    async function saveToDevice() {
      await Promise.resolve();
      try {
        window.localStorage.setItem(WORKSPACE_STORAGE_KEY, serializeWorkspace(workspace));
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
  const guestsOverExpected = activePlan.guestSummary.confirmed !== null && activePlan.guestSummary.confirmed > activePlan.guestSummary.expected;
  const quoteMinimumsOverExpected = activePlan.budget.items.filter((item) => item.minimumGuestCount !== null && item.minimumGuestCount > activePlan.guestSummary.expected);
  const currency = activePlan.budget.currency;

  function updateWorkspace(update: (current: Workspace) => Workspace) {
    setWorkspace((current) => update(current));
  }

  function clearEditorState() {
    setEditing(false);
    setCostDraft(emptyCostDraft());
    setAmountDrafts({});
    setPaidDrafts({});
    setCostMessage("");
    setError("");
    setImportMessage("");
  }

  function selectPlan(planId: string) {
    updateWorkspace((current) => ({ ...current, activePlanId: planId }));
    clearEditorState();
  }

  function updateActivePlan(update: (current: SavedPlan) => SavedPlan) {
    updateWorkspace((current) => ({
      ...current,
      plans: current.plans.map((item) => item.id === current.activePlanId
        ? { ...update(item), updatedAt: new Date().toISOString() }
        : item),
    }));
  }

  function updateBrief<K extends keyof EventBrief>(field: K, value: EventBrief[K]) {
    updateActivePlan((current) => ({ ...current, draftBrief: { ...current.draftBrief, [field]: value } }));
    setError("");
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const parsedBrief = eventBriefSchema.safeParse(brief);
    if (!parsedBrief.success) {
      setError(parsedBrief.error.issues[0]?.message ?? "Check the event details and try again.");
      return;
    }

    try {
      parseBudgetMinor(parsedBrief.data.budgetAmount, parsedBrief.data.currency);
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Check the budget amount.");
      return;
    }

    if (activePlan.edited && !window.confirm("Replace the edited proposal and its checklist with a new AI draft? Recorded costs are kept when the currency matches.")) return;

    const targetPlanId = activePlan.id;
    setGenerating(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedBrief.data),
      });
      const payload = (await response.json()) as { result?: PlanResult; error?: { message?: string } };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error?.message ?? "The plan could not be generated. Your brief is still here.");
      }

      updateWorkspace((current) => ({
        ...current,
        plans: current.plans.map((item) => {
          if (item.id !== targetPlanId) return item;
          const replacement = createSavedPlan(parsedBrief.data, parsedBrief.data, payload.result!.proposal, item.id, new Date().toISOString(), "ai");
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
            const previous = item.tasks.find((candidate) => candidate.title === task.title);
            return previous ? { ...task, status: previous.status, ownerLabel: previous.ownerLabel } : task;
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
      clearEditorState();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The request could not be completed. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  function loadExample() {
    if (activePlan.edited && !window.confirm("Replace this plan with the synthetic example?")) return;
    const example = createSavedPlan(EXAMPLE_BRIEF, EXAMPLE_BRIEF, EXAMPLE_PROPOSAL, activePlan.id, new Date().toISOString());
    updateWorkspace((current) => ({ ...current, plans: current.plans.map((item) => item.id === current.activePlanId ? example : item) }));
    clearEditorState();
  }

  function editProposal(update: (current: PlannerProposal) => PlannerProposal) {
    updateActivePlan((current) => ({ ...current, proposal: update(current.proposal), edited: true }));
  }

  function updateTask(taskId: string, update: (task: TaskRecord) => TaskRecord) {
    updateActivePlan((current) => ({ ...current, edited: true, tasks: current.tasks.map((task) => task.id === taskId ? update(task) : task) }));
  }

  function updateVendor(vendorId: string, update: (vendor: VendorRecord) => VendorRecord) {
    updateActivePlan((current) => ({ ...current, edited: true, vendors: current.vendors.map((vendor) => vendor.id === vendorId ? update(vendor) : vendor) }));
  }

  function updateCost(costId: string, update: (cost: CostItem) => CostItem) {
    updateActivePlan((current) => ({ ...current, edited: true, budget: { ...current.budget, reviewComplete: false, items: current.budget.items.map((cost) => cost.id === costId ? update(cost) : cost) } }));
  }

  function newPlan() {
    if (workspace.plans.length >= MAX_SAVED_PLANS) {
      setImportMessage(`A workspace can hold up to ${MAX_SAVED_PLANS} plans. Export one before adding another.`);
      return;
    }
    const id = makeId();
    const planForWorkspace = createSavedPlan(EXAMPLE_BRIEF, EXAMPLE_BRIEF, EXAMPLE_PROPOSAL, id, new Date().toISOString());
    updateWorkspace((current) => ({ ...current, activePlanId: id, plans: [...current.plans, planForWorkspace] }));
    clearEditorState();
  }

  function deletePlan() {
    if (!window.confirm(`Delete “${activePlan.draftBrief.eventName}” from this device? This cannot be undone.`)) return;
    if (workspace.plans.length === 1) {
      const fresh = createSavedPlan(EXAMPLE_BRIEF, EXAMPLE_BRIEF, EXAMPLE_PROPOSAL, makeId(), new Date().toISOString());
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
      id: makeId(), label: costDraft.label.trim(), category: costDraft.category, vendorId: null,
      amountMinor, amountMaxMinor, pricingModel: costDraft.pricingModel, evidence: costDraft.evidence, paidMinor: 0, mandatory: costDraft.mandatory,
      validUntil: null, minimumGuestCount: null, feesIncluded: null, exclusions: [], sourceNote: "",
    };
    if (cost.label.length < 2) { setCostMessage("Give the cost line a short label first."); return; }
    updateActivePlan((current) => ({ ...current, edited: true, budget: { ...current.budget, reviewComplete: false, items: [...current.budget.items, cost] } }));
    setCostDraft(emptyCostDraft());
    setCostMessage("");
  }

  function removeCost(costId: string) {
    updateActivePlan((current) => ({ ...current, edited: true, budget: { ...current.budget, reviewComplete: false, items: current.budget.items.filter((item) => item.id !== costId) } }));
    setAmountDrafts((current) => { const next = { ...current }; delete next[costId]; delete next[`${costId}:max`]; return next; });
    setPaidDrafts((current) => { const next = { ...current }; delete next[costId]; return next; });
  }

  function resetUnreadableStorage() {
    if (!window.confirm("Replace unreadable local data with a new synthetic example workspace? Exported files are not affected.")) return;
    try {
      window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
      const fresh = createWorkspace(createSavedPlan(EXAMPLE_BRIEF, EXAMPLE_BRIEF, EXAMPLE_PROPOSAL, makeId(), new Date().toISOString()));
      setWorkspace(fresh);
      setStorageLoadFailed(false);
      setStorageError("");
      setStorageStatus("New local workspace");
    } catch (resetError) {
      setStorageError(resetError instanceof Error ? resetError.message : "Could not reset local workspace data.");
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
        const commitmentTotal = forecastCostItem({ ...cost, amountMinor }, activePlan.guestSummary.expected).lowerMinor;
        if (commitmentTotal !== null && cost.paidMinor > commitmentTotal) throw new Error("Amount cannot be less than the payment already recorded.");
        updateCost(cost.id, (current) => ({ ...current, amountMinor, evidence: current.evidence === "unpriced" ? "estimate" : current.evidence }));
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
      updateCost(cost.id, (current) => ({ ...current, amountMaxMinor }));
      setCostMessage("");
    } catch (costError) {
      setCostMessage(costError instanceof Error ? costError.message : "Enter a valid upper amount.");
      setAmountDrafts((current) => ({ ...current, [`${cost.id}:max`]: amountInput(cost.amountMaxMinor, currency) }));
    }
  }

  function updatePaidOnBlur(cost: CostItem, value: string) {
    try {
      const paidMinor = value.trim() ? parseBudgetMinor(value, currency) : 0;
      if (cost.evidence !== "committed" && paidMinor > 0) throw new Error("Mark this item as committed before recording a payment.");
      const commitmentTotal = forecastCostItem(cost, activePlan.guestSummary.expected).lowerMinor;
      if (commitmentTotal !== null && paidMinor > commitmentTotal) throw new Error("Paid amount cannot exceed the recorded commitment total.");
      updateCost(cost.id, (current) => ({ ...current, paidMinor }));
      setCostMessage("");
    } catch (costError) {
      setCostMessage(costError instanceof Error ? costError.message : "Enter a valid payment amount.");
      setPaidDrafts((current) => ({ ...current, [cost.id]: amountInput(cost.paidMinor, currency) }));
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Mehfiloom home">
          <span className="brand-mark"><Flower2 size={21} strokeWidth={1.8} /></span>
          <span className="brand-name">mehfiloom<span className="brand-dot">.</span></span>
        </a>
        <div className="topbar-center"><span className="status-dot" /> Your celebration workspace</div>
        <div className="topbar-right"><span className="avatar-mark">M</span><span>My plans</span></div>
      </header>

      <main id="top" className="main-wrap">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={14} /> A LITTLE HELP WITH THE BIG MOMENTS</div>
            <h1>Make room for a celebration<br className="desktop-break" /> that feels like <em>you.</em></h1>
            <p>Bring your ideas together. We&apos;ll help you shape a thoughtful plan, one good decision at a time.</p>
            <div className="hero-tags" aria-label="Plan weddings, birthdays, and community events">
              {EVENT_TYPES.map((type) => <span key={type}>{EVENT_LABELS[type]}</span>)}
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-ring art-ring-one" /><div className="art-ring art-ring-two" />
            <div className="art-sun"><Flower2 size={42} strokeWidth={1.15} /></div>
            <div className="art-spark art-spark-one">✳</div><div className="art-spark art-spark-two">✦</div>
            <span className="art-caption">made for your kind of gathering</span>
          </div>
        </section>

        <section className="workspace-toolbar" aria-label="Plan library">
          <label className="plan-picker"><span>Local plans</span><select value={workspace.activePlanId} onChange={(event) => selectPlan(event.target.value)}>
            {workspace.plans.map((item) => <option value={item.id} key={item.id}>{item.draftBrief.eventName || "Untitled celebration"}</option>)}
          </select></label>
          <div className="toolbar-actions">
            <span className={`save-indicator ${storageStatus === "Saved on this device" ? "is-saved" : ""}`}><span className="save-dot" />{storageStatus}</span>
            <button type="button" onClick={newPlan}><Plus size={15} /> New plan</button>
            <button type="button" onClick={exportPlan}><ArrowDownToLine size={15} /> Export JSON</button>
            <button type="button" onClick={() => importInput.current?.click()}><Upload size={15} /> Import JSON</button>
            <input ref={importInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={importPlan} aria-label="Choose a Mehfiloom plan JSON file" />
            <button className="delete-plan-button" type="button" onClick={deletePlan}><Trash2 size={15} /> Delete</button>
          </div>
          {storageError && <div className="workspace-message is-error" role="alert">{storageError}{storageLoadFailed && <button type="button" onClick={resetUnreadableStorage}>Reset local plans</button>}</div>}
          {!storageReady && <div className="workspace-message">Loading saved plans from this browser…</div>}
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
              <fieldset className="event-type-fieldset">
                <legend>What are you planning?</legend>
                <div className="event-type-grid">{EVENT_TYPES.map((type) => <button type="button" key={type} className={`event-type-option ${brief.eventType === type ? "selected" : ""}`} aria-pressed={brief.eventType === type} onClick={() => updateBrief("eventType", type)}><span className={`event-type-mark mark-${type}`}>{EVENT_MARKS[type]}</span><span>{EVENT_LABELS[type]}</span></button>)}</div>
              </fieldset>
              <div className="form-grid">
                <label className="field field-full"><span>Event name</span><input value={brief.eventName} onChange={(e) => updateBrief("eventName", e.target.value)} maxLength={80} required /></label>
                <label className="field"><span>Where</span><span className="input-with-icon"><MapPin size={16} /><input value={brief.location} onChange={(e) => updateBrief("location", e.target.value)} maxLength={100} required /></span></label>
                <label className="field"><span>Event date <small>optional</small></span><span className="input-with-icon"><CalendarDays size={16} /><input type="date" value={brief.eventDate} onChange={(e) => updateBrief("eventDate", e.target.value)} /></span></label>
                <label className="field"><span>Guests</span><span className="input-with-icon"><UsersRound size={16} /><input type="number" min={1} max={10000} step={1} value={brief.guestCount} onChange={(e) => updateBrief("guestCount", Number(e.target.value))} required /></span></label>
                <label className="field"><span>Currency code</span><input className="currency-input" value={brief.currency} onChange={(e) => updateBrief("currency", e.target.value.toUpperCase())} maxLength={3} placeholder="INR" autoCapitalize="characters" required /></label>
                <label className="field field-full"><span>Total budget</span><span className="input-with-icon money-input"><span className="currency-prefix" aria-hidden="true">{brief.currency || "¤"}</span><input inputMode="decimal" value={brief.budgetAmount} onChange={(e) => updateBrief("budgetAmount", e.target.value)} placeholder="250000" required aria-describedby="budget-help" /></span><small id="budget-help" className="field-hint">Planning cap in the selected currency. Use a period for decimals.</small></label>
                <label className="field field-full"><span>What should it feel like?</span><textarea value={brief.style} onChange={(e) => updateBrief("style", e.target.value)} rows={3} maxLength={500} placeholder="A relaxed garden gathering, full of family stories…" /></label>
                <label className="field field-full"><span>Must-haves &amp; access needs</span><textarea value={brief.mustHaves} onChange={(e) => updateBrief("mustHaves", e.target.value)} rows={3} maxLength={700} placeholder="Dietary needs, step-free routes, quiet spaces, weather backup…" /><small className="field-hint">We keep these visible in the draft instead of treating them as optional ideas.</small></label>
              </div>
              {error && <div className="form-error" role="alert"><CircleAlert size={17} /><span>{error}</span></div>}
              <button className="generate-button" type="submit" disabled={generating}>{generating ? <span className="button-spinner" aria-hidden="true" /> : <Sparkles size={17} />}<span>{generating ? "Weaving your first draft…" : "Create my plan"}</span>{!generating && <ArrowRight size={17} />}</button>
              <p className="privacy-note"><span className="privacy-dot" /> Live planning sends this brief to Google Gemini. Google says free-tier content is used to improve its products, so use fictional details and avoid real guest names or sensitive information. <a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noreferrer">Free-tier data terms</a>.</p>
            </form>
          </aside>

          <section className="plan-card" aria-labelledby="plan-heading">
            <div className="plan-header"><div><div className="card-kicker"><span className="step-number step-two">02</span> YOUR PLANNING CANVAS</div><div className="plan-title-row"><h2 id="plan-heading">A plan taking shape</h2><span className={`origin-badge ${activePlan.origin === "ai" ? "origin-ai" : "origin-example"}`}><span className="badge-dot" /> {activePlan.origin === "ai" ? "AI draft · review needed" : "Example plan · synthetic"}</span></div><p className="plan-subtitle">A working canvas for your ideas, budget, and next steps.</p></div><button className={`edit-button ${editing ? "is-editing" : ""}`} type="button" onClick={() => setEditing((value) => !value)}>{editing ? <Check size={15} /> : <ClipboardList size={15} />}{editing ? "Done editing" : "Edit draft"}</button></div>
            {briefChanged && <div className="stale-notice"><CircleAlert size={16} /> The brief has changed since this draft was made. Generate again to refresh its suggestions.</div>}
            {guestsOverExpected && <div className="stale-notice"><CircleAlert size={16} /> Confirmed guests exceed the expected count. Update the event brief before relying on the allocation.</div>}
            {quoteMinimumsOverExpected.length > 0 && <div className="stale-notice"><CircleAlert size={16} /> {quoteMinimumsOverExpected.length} cost line{quoteMinimumsOverExpected.length === 1 ? " has" : "s have"} a vendor minimum above expected attendance.</div>}
            <div className="event-summary-strip"><div className="summary-main"><span className="summary-icon"><Flower2 size={18} /></span><span><strong>{submittedBrief.eventName || "Your celebration"}</strong><small>{EVENT_LABELS[submittedBrief.eventType]} · {submittedBrief.location || "Location to decide"}</small></span></div><div className="summary-meta"><span><CalendarDays size={15} />{submittedBrief.eventDate || "Date to decide"}</span><span><UsersRound size={15} />{submittedBrief.guestCount || "—"} guests</span></div></div>
            <div className="guest-summary"><label>Confirmed guests <small>count only · no names</small><input aria-label="Confirmed guest count" type="number" min={0} max={10000} value={activePlan.guestSummary.confirmed ?? ""} placeholder="Not counted yet" onChange={(event) => updateActivePlan((current) => ({ ...current, guestSummary: { ...current.guestSummary, confirmed: event.target.value === "" ? null : Number(event.target.value) } }))} /></label><span>{activePlan.guestSummary.confirmed === null ? "Attendance has not been counted." : `${activePlan.guestSummary.confirmed} confirmed of ${activePlan.guestSummary.expected} expected`}</span></div>
            {submittedBrief.mustHaves && <div className="must-have-strip"><span>HOST MUST-HAVES</span><p>{submittedBrief.mustHaves}</p></div>}

            <div className="plan-overview"><div className="plan-overview-copy"><span className="section-label"><span className="tiny-spark">✦</span> THE STARTING IDEA</span>{editing ? <><input className="edit-title-input" aria-label="Plan title" value={proposal.conceptTitle} onChange={(e) => editProposal((current) => ({ ...current, conceptTitle: e.target.value }))} maxLength={80} /><textarea className="edit-overview-input" aria-label="Plan overview" value={proposal.overview} onChange={(e) => editProposal((current) => ({ ...current, overview: e.target.value }))} maxLength={500} rows={4} /></> : <><h3>{proposal.conceptTitle}</h3><p>{proposal.overview}</p></>}<div className="theme-note"><span className="theme-flower">✿</span><span><small>THE FEEL</small>{editing ? <input aria-label="Event theme" value={proposal.theme} onChange={(e) => editProposal((current) => ({ ...current, theme: e.target.value }))} maxLength={100} /> : proposal.theme}</span></div></div><div className="overview-art" aria-hidden="true"><span className="art-leaf leaf-a">❧</span><span className="art-flower">✿</span><span className="art-leaf leaf-b">❧</span><span className="art-orbit" /></div></div>

            <div className="section-heading budget-heading"><div><span className="section-label">THE BUDGET PICTURE</span><h3>Give every part a place</h3></div><span className="budget-total">{formatMoney(plan.totalMinor, plan.currency)} <small>planning cap</small></span></div>
            <div className="budget-surface"><div className="budget-topline"><span><CircleCheck size={16} /> Allocation adds up to your cap</span><small>Planning targets · not vendor quotes</small></div><div className="budget-grid">{plan.lines.map((line, index) => { const percentage = Math.max(0, Math.min(100, (line.amountMinor / Math.max(budgetTotal, 1)) * 100)); const category = BUDGET_CATEGORIES.find((item) => item === line.category); return <div className="budget-line" key={`${line.category}-${index}`}><div className="budget-line-head"><span>{category ? CATEGORY_LABELS[category] : line.category}</span><strong>{formatMoney(line.amountMinor, plan.currency)}</strong></div><div className="budget-track"><span className={`budget-fill fill-${index % 5}`} style={{ width: `${percentage}%` }} /></div><p>{line.rationale}</p></div>; })}</div><div className="budget-footnote">The split comes from relative priorities and exact arithmetic. Local costs, tax, and vendor availability still need checking.</div></div>

            <div className="section-heading timeline-heading"><div><span className="section-label">SMALL STEPS, GOOD MOMENTUM</span><h3>Your next steps <span className="task-count">{completeCount}/{activePlan.tasks.length} done</span></h3></div><span className="heading-icon"><CalendarDays size={18} /></span></div>
            <div className="timeline-list">{activePlan.tasks.map((task, index) => <div className={`timeline-item ${task.status === "done" ? "task-done" : ""}`} key={task.id}><button className="task-check" type="button" aria-label={`${task.status === "done" ? "Mark incomplete" : "Mark complete"}: ${task.title}`} aria-pressed={task.status === "done"} onClick={() => updateTask(task.id, (current) => ({ ...current, status: current.status === "done" ? "todo" : "done" }))}>{task.status === "done" && <Check size={13} />}</button><div className="timeline-copy">{editing ? <><input aria-label={`Task ${index + 1}`} value={task.title} onChange={(event) => updateTask(task.id, (current) => ({ ...current, title: event.target.value }))} maxLength={120} /><input aria-label={`Task ${index + 1} timing`} value={task.timing} onChange={(event) => updateTask(task.id, (current) => ({ ...current, timing: event.target.value }))} maxLength={80} /><div className="task-meta-edit"><label>Owner<input aria-label={`Task ${index + 1} owner`} value={task.ownerLabel} onChange={(event) => updateTask(task.id, (current) => ({ ...current, ownerLabel: event.target.value }))} maxLength={80} /></label><label>Due date<input aria-label={`Task ${index + 1} due date`} type="date" value={task.dueDate ?? ""} onChange={(event) => updateTask(task.id, (current) => ({ ...current, dueDate: event.target.value || null }))} /></label></div></> : <><strong>{task.title}</strong><span><CalendarDays size={13} />{task.dueDate || task.timing} · {task.ownerLabel}</span></>}</div><span className={`priority priority-${task.priority}`}>{task.priority}</span></div>)}</div>

            <section className="costs-section" aria-labelledby="cost-heading"><div className="section-heading compact-heading"><div><span className="section-label">KNOWN, QUOTED &amp; STILL TO CHECK</span><h3 id="cost-heading">Cost register</h3></div><span className="soft-icon"><CircleCheck size={16} /></span></div>
              {budgetHealth ? <div className={`budget-health health-${budgetHealth.state}`}><div><strong>{budgetHealth.state === "within_cap" ? "Recorded costs plus reserve fit the cap" : budgetHealth.state === "over_cap" ? "Recorded costs plus reserve exceed the cap" : budgetHealth.state === "range_crosses_cap" ? "Cost range crosses the cap" : activePlan.budget.reviewComplete ? "Review mandatory costs and fees" : "Budget review is still open"}</strong><small>{budgetHealth.unresolvedCount} unpriced · {budgetHealth.unresolvedMandatoryCount} mandatory and unpriced · {budgetHealth.unknownMandatoryFeeCount} mandatory fee status unknown</small></div><div className="health-number">{moneyRange(budgetHealth.forecastWithReserveMinor, budgetHealth.forecastWithReserveMaxMinor, currency)}<small>forecast including reserve</small></div></div> : <div className="budget-health health-unknown"><strong>Fix invalid plan fields to recalculate the budget.</strong></div>}
              {budgetHealth && budgetHealth.state === "over_cap" && <div className="form-error" role="alert"><CircleAlert size={16} /><span>This recorded forecast is above the cap. Reduce costs or revise the cap before treating the plan as feasible.</span></div>}
              {budgetHealth?.state === "range_crosses_cap" && <div className="form-error" role="alert"><CircleAlert size={16} /><span>The upper forecast exceeds the cap; this range cannot be treated as affordable.</span></div>}
              <div className="cost-rollup"><span>Cap <strong>{formatMoney(activePlan.budget.capMinor, currency)}</strong></span><span>Known costs <strong>{moneyRange(budgetHealth?.knownCostsMinor ?? 0, budgetHealth?.knownCostsMaxMinor ?? 0, currency)}</strong></span><span>Reserve <strong>{formatMoney(budgetHealth?.reserveMinor ?? 0, currency)}</strong></span><span>Paid <strong>{formatMoney(budgetHealth?.paidMinor ?? 0, currency)}</strong></span><span>Committed outstanding <strong>{formatMoney(budgetHealth?.outstandingCommittedMinor ?? 0, currency)}</strong></span></div>
              <div className="cost-list">{activePlan.budget.items.map((cost) => <article className="cost-item" key={cost.id}><div className="cost-item-head"><div><strong>{cost.label}</strong><small>{CATEGORY_LABELS[cost.category]} · {costEvidenceSummary(cost, currency, activePlan.guestSummary.expected)}</small></div>{editing && <button className="icon-button" type="button" onClick={() => removeCost(cost.id)} aria-label={`Remove ${cost.label}`}><Trash2 size={15} /></button>}</div>
                {editing ? <div className="cost-edit-grid"><label>Line label<input value={cost.label} maxLength={100} onChange={(event) => updateCost(cost.id, (current) => ({ ...current, label: event.target.value }))} /></label><label>Category<select value={cost.category} onChange={(event) => updateCost(cost.id, (current) => ({ ...current, category: event.target.value as CostItem["category"] }))}>{BUDGET_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}</select></label><label>Price basis<select value={cost.pricingModel} onChange={(event) => { const pricingModel = event.target.value as CostItem["pricingModel"]; const candidate = { ...cost, pricingModel }; const total = forecastCostItem(candidate, activePlan.guestSummary.expected).lowerMinor; if (total !== null && cost.paidMinor > total) { setCostMessage("The new price basis would put paid amount above the commitment."); return; } setCostMessage(""); updateCost(cost.id, (current) => ({ ...current, pricingModel })); }}><option value="fixed">Fixed total</option><option value="per_guest">Per guest</option></select></label><label>{cost.pricingModel === "per_guest" ? "Rate per guest (" + currency + ")" : "Lower amount (" + currency + ")"}<input inputMode="decimal" value={amountDrafts[cost.id] ?? amountInput(cost.amountMinor, currency)} placeholder="Unknown" onChange={(event) => setAmountDrafts((current) => ({ ...current, [cost.id]: event.target.value }))} onBlur={(event) => updateAmountOnBlur(cost, event.target.value)} /></label><label>Upper amount / rate ({currency})<input inputMode="decimal" value={amountDrafts[cost.id + ":max"] ?? amountInput(cost.amountMaxMinor, currency)} placeholder="Same as lower" disabled={cost.evidence === "committed"} onChange={(event) => setAmountDrafts((current) => ({ ...current, [cost.id + ":max"]: event.target.value }))} onBlur={(event) => updateMaxAmountOnBlur(cost, event.target.value)} /></label><label>Evidence<select value={cost.evidence} onChange={(event) => { const evidence = event.target.value as CostItem["evidence"]; if (evidence !== "unpriced" && cost.amountMinor === null) { setCostMessage("Enter an amount before marking this cost as an estimate, quote, or commitment."); return; } if (evidence === "committed" && cost.amountMaxMinor !== null && cost.amountMaxMinor !== cost.amountMinor) { setCostMessage("Clear the upper amount before recording an exact commitment."); return; } setCostMessage(""); updateCost(cost.id, (current) => ({ ...current, evidence, ...(evidence === "unpriced" ? { amountMinor: null, amountMaxMinor: null, paidMinor: 0 } : {}) })); }}><option value="unpriced">Unpriced</option><option value="estimate">Estimate</option><option value="quote">Quote</option><option value="committed">Committed</option></select></label><label>Paid ({currency})<input inputMode="decimal" value={paidDrafts[cost.id] ?? amountInput(cost.paidMinor, currency)} disabled={cost.evidence !== "committed"} onChange={(event) => setPaidDrafts((current) => ({ ...current, [cost.id]: event.target.value }))} onBlur={(event) => updatePaidOnBlur(cost, event.target.value)} /></label><label className="checkbox-field"><input type="checkbox" checked={cost.mandatory} onChange={(event) => updateCost(cost.id, (current) => ({ ...current, mandatory: event.target.checked }))} /> Mandatory to the event</label><label>Quote valid until<input type="date" value={cost.validUntil ?? ""} onChange={(event) => updateCost(cost.id, (current) => ({ ...current, validUntil: event.target.value || null }))} /></label><label>Minimum guests<input type="number" min={1} max={10000} value={cost.minimumGuestCount ?? ""} onChange={(event) => updateCost(cost.id, (current) => ({ ...current, minimumGuestCount: event.target.value ? Number(event.target.value) : null }))} /></label><label>Fees status<select value={cost.feesIncluded === null ? "unknown" : cost.feesIncluded ? "included" : "excluded"} onChange={(event) => updateCost(cost.id, (current) => ({ ...current, feesIncluded: event.target.value === "unknown" ? null : event.target.value === "included" }))}><option value="unknown">Unknown</option><option value="included">Included</option><option value="excluded">Excluded / extra</option></select></label><label className="field-wide">Source / exclusion notes<textarea value={cost.sourceNote} maxLength={300} onChange={(event) => updateCost(cost.id, (current) => ({ ...current, sourceNote: event.target.value }))} placeholder="Who provided this and what is excluded?" /></label></div> : <div className="cost-evidence"><span>{cost.sourceNote || "No source recorded."}</span>{cost.validUntil && <small>Valid until {cost.validUntil}</small>}{cost.minimumGuestCount && <small>Minimum guests: {cost.minimumGuestCount}</small>}{cost.feesIncluded === null ? <small>Fees unknown</small> : cost.feesIncluded ? <small>Fees included</small> : <small>Fees excluded or extra</small>}</div>}</article>)}</div>
              <form className="add-cost-form" onSubmit={addCost}><h4>Add a cost or quote</h4><div className="add-cost-grid"><label>Label<input required minLength={2} maxLength={100} value={costDraft.label} onChange={(event) => setCostDraft((current) => ({ ...current, label: event.target.value }))} placeholder="e.g. Community hall" /></label><label>Category<select value={costDraft.category} onChange={(event) => setCostDraft((current) => ({ ...current, category: event.target.value as CostItem["category"] }))}>{BUDGET_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}</select></label><label>Price basis<select value={costDraft.pricingModel} onChange={(event) => setCostDraft((current) => ({ ...current, pricingModel: event.target.value as CostItem["pricingModel"] }))}><option value="fixed">Fixed total</option><option value="per_guest">Per guest</option></select></label><label>Evidence<select value={costDraft.evidence} onChange={(event) => { const evidence = event.target.value as CostItem["evidence"]; if (evidence === "committed" && costDraft.maxAmount.trim()) { try { if (parseBudgetMinor(costDraft.maxAmount, currency) !== parseBudgetMinor(costDraft.amount, currency)) throw new Error(); } catch { setCostMessage("Clear the upper amount before choosing an exact commitment."); return; } } setCostMessage(""); setCostDraft((current) => ({ ...current, evidence })); }}><option value="unpriced">Unpriced</option><option value="estimate">Estimate</option><option value="quote">Quote</option><option value="committed">Committed</option></select></label><label>Lower amount / rate ({currency})<input inputMode="decimal" value={costDraft.amount} disabled={costDraft.evidence === "unpriced"} onChange={(event) => setCostDraft((current) => ({ ...current, amount: event.target.value }))} placeholder={costDraft.evidence === "unpriced" ? "No amount yet" : "e.g. 1200"} /></label><label>Upper amount / rate ({currency})<input inputMode="decimal" value={costDraft.maxAmount} disabled={costDraft.evidence === "unpriced" || costDraft.evidence === "committed"} onChange={(event) => setCostDraft((current) => ({ ...current, maxAmount: event.target.value }))} placeholder="Same as lower" /></label><label className="checkbox-field"><input type="checkbox" checked={costDraft.mandatory} onChange={(event) => setCostDraft((current) => ({ ...current, mandatory: event.target.checked }))} /> Mandatory</label><button type="submit"><Plus size={15} /> Add cost</button></div></form>
              <label className="review-checkbox"><input type="checkbox" checked={activePlan.budget.reviewComplete} onChange={(event) => updateActivePlan((current) => ({ ...current, budget: { ...current.budget, reviewComplete: event.target.checked } }))} /> I reviewed the recorded costs and know what remains unknown.</label>
              {costMessage && <div className="form-error cost-form-message" role="status"><CircleAlert size={16} /><span>{costMessage}</span></div>}
            </section>

            <div className="lower-grid"><section className="ideas-section"><div className="section-heading compact-heading"><div><span className="section-label">PERSONAL TOUCHES</span><h3>Ideas that fit</h3></div><span className="soft-icon"><Sparkles size={16} /></span></div><div className="ideas-list">{proposal.ideas.map((idea, index) => <article className="idea-item" key={`${index}-${idea.title}`}><span className={`idea-number idea-number-${index % 3}`}>0{index + 1}</span><div><strong>{idea.title}</strong><p>{idea.whyItFits}</p><small>{idea.costNote}</small></div></article>)}</div></section>
              <section className="vendors-section"><div className="section-heading compact-heading"><div><span className="section-label">ASK BEFORE YOU BOOK</span><h3>Vendor checklist</h3></div><span className="soft-icon"><Store size={16} /></span></div><div className="vendor-list">{activePlan.vendors.map((vendor) => <details className="vendor-accordion" key={vendor.id}><summary><span>{vendor.category}{vendor.name ? ` · ${vendor.name}` : ""}</span><ChevronDown size={15} /></summary><div className="vendor-detail"><ul>{vendor.questions.map((question, questionIndex) => <li key={questionIndex}>{question}</li>)}</ul>{editing ? <div className="vendor-edit-grid"><label>Vendor name<input value={vendor.name ?? ""} maxLength={80} onChange={(event) => updateVendor(vendor.id, (current) => ({ ...current, name: event.target.value || null }))} /></label><label>Availability<select value={vendor.availability} onChange={(event) => updateVendor(vendor.id, (current) => ({ ...current, availability: event.target.value as VendorRecord["availability"], checkedAt: new Date().toISOString() }))}><option value="unknown">Unknown</option><option value="inquiry_pending">Inquiry sent</option><option value="confirmed">Confirmed</option><option value="expired">Expired</option></select></label><label>Booking<select value={vendor.booking} onChange={(event) => updateVendor(vendor.id, (current) => ({ ...current, booking: event.target.value as VendorRecord["booking"] }))}><option value="not_booked">Not booked</option><option value="host_recorded">Host says booked</option><option value="cancelled">Cancelled</option></select></label><label>Notes<textarea value={vendor.notes} maxLength={500} onChange={(event) => updateVendor(vendor.id, (current) => ({ ...current, notes: event.target.value }))} /></label></div> : <div className="vendor-status"><span>Availability: {vendor.availability.replaceAll("_", " ")}</span><span>Booking: {vendor.booking.replaceAll("_", " ")}</span>{vendor.notes && <p>{vendor.notes}</p>}</div>}</div></details>)}</div><p className="vendor-caveat">Checklist categories are ideas to explore. No vendors or availability are confirmed until you record them.</p></section></div>
            <div className="questions-box"><div><span className="section-label">KEEP THESE VISIBLE</span><h3>Open questions &amp; assumptions</h3></div><div className="question-columns"><div><strong>Worth deciding</strong><ul>{proposal.openQuestions.map((item, index) => <li key={index}>{item}</li>)}</ul></div><div><strong>Currently assumed</strong><ul>{proposal.assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul></div></div></div>
            <div className="plan-footer"><span><CircleAlert size={15} /> You stay in charge of costs, bookings, and final decisions.</span><span>Made with care <Flower2 size={14} /></span></div>
          </section>
        </div>
        <footer className="page-footer"><span>Mehfiloom <span className="brand-dot">·</span> Weave your perfect celebration.</span><span>Thoughtful plans start with your people.</span></footer>
      </main>
    </div>
  );
}

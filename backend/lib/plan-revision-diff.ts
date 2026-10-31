import { normalizedPlanLabel } from "./plan-record-primitives.ts";
import { validateSavedPlan, type SavedPlan } from "./plan-store.ts";

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export type RevisionChange = { title: string; detail: string };

function concise(value: string, limit = 70): string {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return "Not set";
  return cleaned.length > limit ? `${cleaned.slice(0, limit - 1)}…` : cleaned;
}

function summarize(values: string[], limit = 3): string {
  if (values.length === 0) return "";
  const visible = values
    .slice(0, limit)
    .map((value) => `“${concise(value, 42)}”`)
    .join(", ");
  return values.length > limit
    ? `${visible}, +${values.length - limit} more`
    : visible;
}

export function diffPlanRevision(
  baseInput: SavedPlan,
  candidateInput: SavedPlan,
): RevisionChange[] {
  const base = validateSavedPlan(baseInput);
  const candidate = validateSavedPlan(candidateInput);
  const changes: RevisionChange[] = [];
  const briefLabels: Record<keyof SavedPlan["planBrief"], string> = {
    eventType: "Event type",
    eventName: "Event name",
    location: "Location",
    eventDate: "Event date",
    timeZone: "Event time zone",
    eventTime: "Local event time",
    eventTimeOccurrence: "Repeated-time choice",
    guestCount: "Guest count",
    sessions: "Sessions / functions",
    budgetAmount: "Budget cap",
    currency: "Currency",
    style: "Style direction",
    mustHaves: "Must-haves and access needs",
  };
  const changedBriefFields = (
    Object.keys(briefLabels) as (keyof SavedPlan["planBrief"])[]
  ).filter((field) => !same(base.planBrief[field], candidate.planBrief[field]));
  if (changedBriefFields.length > 0) {
    const detail = changedBriefFields
      .map((field) => {
        if (
          field === "eventName" ||
          field === "location" ||
          field === "eventDate" ||
          field === "timeZone" ||
          field === "eventTime" ||
          field === "budgetAmount" ||
          field === "style" ||
          field === "mustHaves"
        ) {
          return `${briefLabels[field]}: ${concise(base.planBrief[field] || "Not set")} → ${concise(candidate.planBrief[field] || "Not set")}`;
        }
        return briefLabels[field];
      })
      .join(" · ");
    changes.push({ title: "Event brief", detail });
  }

  const oldSessions = new Map(
    base.planBrief.sessions.map((session) => [session.id, session]),
  );
  const newSessions = new Map(
    candidate.planBrief.sessions.map((session) => [session.id, session]),
  );
  const sessionDetails = [
    ...candidate.planBrief.sessions
      .filter((session) => !oldSessions.has(session.id))
      .map(
        (session) =>
          `Added ${concise(session.name)} (${session.guestCount} expected)`,
      ),
    ...candidate.planBrief.sessions.flatMap((session) => {
      const previous = oldSessions.get(session.id);
      if (!previous) return [];
      const differences = [
        previous.name !== session.name
          ? `renamed to ${concise(session.name)}`
          : "",
        previous.date !== session.date
          ? `date ${concise(previous.date || "Not set")} → ${concise(session.date || "Not set")}`
          : "",
        previous.startTime !== session.startTime
          ? `start time ${concise(previous.startTime || "Not set")} → ${concise(session.startTime || "Not set")}`
          : "",
        previous.guestCount !== session.guestCount
          ? `${previous.guestCount} → ${session.guestCount} expected`
          : "",
      ].filter(Boolean);
      return differences.length
        ? [`${concise(session.name)}: ${differences.join(", ")}`]
        : [];
    }),
    ...base.planBrief.sessions
      .filter((session) => !newSessions.has(session.id))
      .map((session) => `Removed ${concise(session.name)}`),
  ];
  if (sessionDetails.length)
    changes.push({
      title: "Session attendance",
      detail: sessionDetails.slice(0, 5).join(" · "),
    });

  const oldProposal = base.proposal;
  const newProposal = candidate.proposal;
  const directionChanges: string[] = [];
  if (oldProposal.conceptTitle !== newProposal.conceptTitle)
    directionChanges.push(
      `Title: “${concise(oldProposal.conceptTitle, 45)}” → “${concise(newProposal.conceptTitle, 45)}”`,
    );
  if (oldProposal.overview !== newProposal.overview)
    directionChanges.push("The overview has been rewritten");
  if (oldProposal.theme !== newProposal.theme)
    directionChanges.push("The theme direction has changed");
  if (!same(oldProposal.ideas, newProposal.ideas))
    directionChanges.push(`${newProposal.ideas.length} personal ideas revised`);
  if (!same(oldProposal.openQuestions, newProposal.openQuestions))
    directionChanges.push("Open questions updated");
  if (!same(oldProposal.assumptions, newProposal.assumptions))
    directionChanges.push("Assumptions updated");
  if (directionChanges.length > 0)
    changes.push({
      title: "Plan direction",
      detail: directionChanges.join(" · "),
    });

  if (!same(oldProposal.budgetAllocations, newProposal.budgetAllocations)) {
    const oldByCategory = new Map(
      oldProposal.budgetAllocations.map((item) => [item.category, item]),
    );
    const newByCategory = new Map(
      newProposal.budgetAllocations.map((item) => [item.category, item]),
    );
    const added = newProposal.budgetAllocations
      .filter((item) => !oldByCategory.has(item.category))
      .map((item) => item.category);
    const removed = oldProposal.budgetAllocations
      .filter((item) => !newByCategory.has(item.category))
      .map((item) => item.category);
    const updated = newProposal.budgetAllocations.flatMap((item) => {
      const previous = oldByCategory.get(item.category);
      if (!previous) return [];
      if (previous.weight !== item.weight)
        return [`${item.category} weight ${previous.weight} → ${item.weight}`];
      return previous.rationale !== item.rationale
        ? [`${item.category} rationale`]
        : [];
    });
    const details = [
      added.length
        ? `Added ${added.length} relative-weight categories: ${summarize(added)}`
        : "",
      removed.length
        ? `Removed ${removed.length} relative-weight categories: ${summarize(removed)}`
        : "",
      updated.length ? `Updated ${updated.length}: ${summarize(updated)}` : "",
    ].filter(Boolean);
    changes.push({
      title: "Budget priorities",
      detail: `${details.join(" · ") || "Relative weights or rationales changed"}. Acceptance recalculates allocations against the cap.`,
    });
  }
  if (!same(oldProposal.timeline, newProposal.timeline)) {
    const taskKey = (task: (typeof oldProposal.timeline)[number]) =>
      `${task.sessionId ?? "shared"}:${normalizedPlanLabel(task.task)}`;
    const oldTasks = new Map(
      oldProposal.timeline.map((task) => [taskKey(task), task]),
    );
    const newTasks = new Map(
      newProposal.timeline.map((task) => [taskKey(task), task]),
    );
    const added = newProposal.timeline
      .filter((task) => !oldTasks.has(taskKey(task)))
      .map((task) => task.task);
    const removed = oldProposal.timeline
      .filter((task) => !newTasks.has(taskKey(task)))
      .map((task) => task.task);
    const updated = newProposal.timeline.flatMap((task) => {
      const previous = oldTasks.get(taskKey(task));
      return previous &&
        (previous.timing !== task.timing || previous.priority !== task.priority)
        ? [task.task]
        : [];
    });
    const details = [
      added.length ? `Added ${added.length}: ${summarize(added)}` : "",
      removed.length ? `Removed ${removed.length}: ${summarize(removed)}` : "",
      updated.length
        ? `Timing or priority changed for ${updated.length}: ${summarize(updated)}`
        : "",
    ].filter(Boolean);
    changes.push({
      title: "Timeline suggestions",
      detail:
        details.join(" · ") ||
        `${base.tasks.length} current tasks · ${candidate.tasks.length} proposed tasks`,
    });
  }
  if (!same(oldProposal.vendorChecklist, newProposal.vendorChecklist)) {
    const oldVendors = new Map(
      oldProposal.vendorChecklist.map((vendor) => [
        normalizedPlanLabel(vendor.category),
        vendor,
      ]),
    );
    const newVendors = new Map(
      newProposal.vendorChecklist.map((vendor) => [
        normalizedPlanLabel(vendor.category),
        vendor,
      ]),
    );
    const added = newProposal.vendorChecklist
      .filter((vendor) => !oldVendors.has(normalizedPlanLabel(vendor.category)))
      .map((vendor) => vendor.category);
    const removed = oldProposal.vendorChecklist
      .filter((vendor) => !newVendors.has(normalizedPlanLabel(vendor.category)))
      .map((vendor) => vendor.category);
    const updated = newProposal.vendorChecklist.flatMap((vendor) => {
      const previous = oldVendors.get(normalizedPlanLabel(vendor.category));
      return previous && !same(previous.questions, vendor.questions)
        ? [vendor.category]
        : [];
    });
    const details = [
      added.length ? `Added categories: ${summarize(added)}` : "",
      removed.length ? `Removed categories: ${summarize(removed)}` : "",
      updated.length ? `Questions revised for: ${summarize(updated)}` : "",
    ].filter(Boolean);
    changes.push({
      title: "Vendor checklist",
      detail:
        details.join(" · ") ||
        `${base.vendors.length} current categories · ${candidate.vendors.length} proposed categories`,
    });
  }
  if (changes.length === 0)
    changes.push({
      title: "No material content change",
      detail:
        "The returned draft matches the current plan. You can discard it without changing anything.",
    });
  return changes;
}

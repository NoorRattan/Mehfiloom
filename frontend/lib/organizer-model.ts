import { parseBudgetMinor } from "@/lib/planner";
import { events, money } from "./events";
import type { Workspace } from "./workspace-store";

export type ChecklistTask = { title: string; timing: string };

export function organizerTasks(state: Workspace): ChecklistTask[] {
  const tasks = new Map<string, ChecklistTask>();
  for (const title of events[state.brief.eventType].tasks) {
    tasks.set(title, { title, timing: "Your next steps" });
  }
  if (state.resultSource === "ai") {
    for (const item of state.result?.proposal.timeline ?? []) {
      if (!tasks.has(item.task))
        tasks.set(item.task, { title: item.task, timing: item.timing });
    }
  }
  for (const title of state.customTasks) {
    if (!tasks.has(title)) tasks.set(title, { title, timing: "Added by you" });
  }
  return [...tasks.values()];
}

export function organizerBudgetLabel(state: Workspace): string {
  try {
    return money(
      parseBudgetMinor(state.brief.budgetAmount, state.brief.currency),
      state.brief.currency,
    );
  } catch {
    return "Set your budget";
  }
}

const eventDateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function organizerDateLabel(value: string): string {
  if (!value) return "A date to look forward to";
  const date = new Date(`${value}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    date.getUTCFullYear() < 1900
  ) {
    return "A date to confirm";
  }
  return eventDateFormatter.format(date);
}

"use client";

import { useState } from "react";
import {
  buildPlanResult,
  getEventTemplateProposal,
  parseBudgetMinor,
  type EventBrief,
  type PlanResult,
} from "@/lib/planner";
import { MAX_CUSTOM_TASKS } from "../../backend/lib/planning-limits";
import { events, type EventKind } from "./events";
import { useWorkspace } from "./workspace-store";
import { organizerBudgetLabel, organizerTasks } from "./organizer-model";
import { downloadPlanText, exportWorkspaceText } from "./plan-export";

/** Organizer mutations always validate against the latest shared browser draft. */
export function useOrganizer(kind: EventKind) {
  const { state, update, storageStatus } = useWorkspace(kind);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const tasks = organizerTasks(state);
  const completed = tasks.filter((task) =>
    state.checked.includes(task.title),
  ).length;
  const completion = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;
  const budgetLabel = organizerBudgetLabel(state);
  const vendors =
    state.result?.proposal.vendorChecklist ??
    events[kind].vendors.map((category) => ({
      category,
      questions: [
        "What is included in your quote?",
        "Is our preferred date available?",
        "What are the deposit and cancellation terms?",
      ],
    }));

  function change<K extends keyof EventBrief>(key: K, value: EventBrief[K]) {
    update((current) => ({
      ...current,
      brief: { ...current.brief, [key]: value },
    }));
  }
  function toggleTask(title: string) {
    update((current) => ({
      ...current,
      checked: current.checked.includes(title)
        ? current.checked.filter((item) => item !== title)
        : [...current.checked, title],
    }));
  }
  function addTask(rawTitle: string): boolean {
    const title = rawTitle.trim();
    let problem = "";
    const accepted = update((current) => {
      if (!title || title.length > 120)
        problem = "Give this task a name between 1 and 120 characters.";
      else if (organizerTasks(current).some((task) => task.title === title))
        problem = "That task is already on your list.";
      else if (current.customTasks.length >= MAX_CUSTOM_TASKS)
        problem = `Your checklist has reached ${MAX_CUSTOM_TASKS} custom tasks.`;
      return problem
        ? current
        : { ...current, customTasks: [...current.customTasks, title] };
    });
    setError(problem);
    return accepted && !problem;
  }
  function recalculateBudget(): boolean {
    setError("");
    setNotice("");
    try {
      const accepted = update((current) => ({
        ...current,
        result: buildPlanResult(
          current.result?.proposal ?? getEventTemplateProposal(kind),
          current.brief.currency,
          parseBudgetMinor(current.brief.budgetAmount, current.brief.currency),
        ),
        resultSource: current.resultSource ?? "starter",
      }));
      if (accepted) setNotice("Your budget allocation is ready.");
      return accepted;
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Please check your budget.",
      );
      return false;
    }
  }
  function saveBudget(result: PlanResult, expected: PlanResult): boolean {
    let applied = false;
    const accepted = update((current) => {
      if (JSON.stringify(current.result) !== JSON.stringify(expected))
        return current;
      applied = true;
      return { ...current, result };
    });
    if (!applied)
      setError(
        "Your budget changed in another tab. Close this editor and reopen it to use the latest allocation.",
      );
    else if (accepted) {
      setError("");
      setNotice("Your budget allocation is updated.");
    }
    return accepted && applied;
  }
  function changeVendorNote(category: string, note: string) {
    update((current) => ({
      ...current,
      vendorNotes: { ...current.vendorNotes, [category]: note },
    }));
  }
  function exportPlan() {
    setError("");
    setNotice("");
    try {
      downloadPlanText(
        exportWorkspaceText(state, tasks, budgetLabel),
        `mehfiloom-${kind}-plan.txt`,
      );
      setNotice("Your plan has been exported.");
    } catch {
      setError(
        "Your browser couldn’t export this plan. Your draft is unchanged; please try again.",
      );
    }
  }
  return {
    state,
    storageStatus,
    tasks,
    vendors,
    completed,
    completion,
    budgetLabel,
    notice,
    error,
    dismissNotice: () => setNotice(""),
    change,
    toggleTask,
    addTask,
    recalculateBudget,
    saveBudget,
    changeVendorNote,
    exportPlan,
  };
}

import { CATEGORY_LABELS } from "@/lib/planner";
import { events, money } from "./events";
import type { Workspace } from "./workspace-store";

/** Keep the download URL alive until the browser has consumed the click. */
export function downloadPlanText(text: string, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  try {
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** A portable, readable copy of the complete planning draft, including caveats. */
export function exportWorkspaceText(
  state: Workspace,
  tasks: readonly { title: string; timing: string }[],
  budgetLabel: string,
) {
  const { brief, result } = state;
  const lines = [
    brief.eventName || `My ${events[brief.eventType].singular}`,
    `Location: ${brief.location || "To be decided"}`,
    `Date: ${brief.eventDate || "To be decided"}`,
    `Guests: ${brief.guestCount}`,
    `Current budget: ${budgetLabel}`,
    `Style: ${brief.style || "To be decided"}`,
    `Must-haves: ${brief.mustHaves || "None recorded"}`,
  ];
  if (brief.timeZone) lines.push(`Time zone: ${brief.timeZone}`);
  if (brief.eventTime)
    lines.push(
      `Local start: ${brief.eventTime}${brief.eventTimeOccurrence ? ` (${brief.eventTimeOccurrence} occurrence)` : ""}`,
    );
  if (brief.sessions.length) {
    lines.push(
      "",
      "FUNCTIONS / SESSIONS",
      ...brief.sessions.map(
        (session) =>
          `${session.name}: ${session.date}${session.startTime ? ` at ${session.startTime}` : ""}${session.startTimeOccurrence ? ` (${session.startTimeOccurrence} occurrence)` : ""} — ${session.guestCount} guests`,
      ),
    );
  }
  lines.push(
    "",
    "CHECKLIST",
    ...tasks.map(
      (item) =>
        `${state.checked.includes(item.title) ? "[x]" : "[ ]"} ${item.title} — ${item.timing}`,
    ),
  );
  if (result) {
    const { proposal } = result;
    lines.push(
      "",
      state.resultSource === "ai"
        ? "AI PLANNING DRAFT"
        : "STARTER PLANNING DRAFT",
      proposal.conceptTitle,
      proposal.overview,
      `Theme: ${proposal.theme}`,
      "",
      `BUDGET ALLOCATION (${result.currency})`,
      ...result.lines.map(
        (line) =>
          `${CATEGORY_LABELS[line.category]}: ${money(line.amountMinor, result.currency)} — ${line.rationale}`,
      ),
      `Total allocated: ${money(result.allocatedMinor, result.currency)}`,
      "Planning allocations are not vendor quotes. Confirm actual costs and availability.",
      "",
      "TIMELINE",
      ...proposal.timeline.map(
        (item) => `${item.timing}: ${item.task} [${item.priority} priority]`,
      ),
      "",
      "PERSONAL IDEAS",
      ...proposal.ideas.map(
        (idea) =>
          `${idea.title}: ${idea.whyItFits}\nCost note: ${idea.costNote}`,
      ),
      "",
      "VENDOR QUESTIONS",
      ...proposal.vendorChecklist.flatMap((group) => [
        group.category,
        ...group.questions.map((question) => `- ${question}`),
      ]),
      "",
      "OPEN QUESTIONS",
      ...proposal.openQuestions.map((question) => `- ${question}`),
      "",
      "ASSUMPTIONS TO CHECK",
      ...proposal.assumptions.map((assumption) => `- ${assumption}`),
    );
  }
  lines.push(
    "",
    "VENDOR NOTES",
    ...Object.entries(state.vendorNotes).map(
      ([category, notes]) => `${category}: ${notes}`,
    ),
  );
  if (state.revisionRequests.length) {
    lines.push(
      "",
      "REVISION REQUESTS",
      ...state.revisionRequests.map(
        (request, index) => `${index + 1}. ${request}`,
      ),
    );
  }
  return lines.join("\n");
}

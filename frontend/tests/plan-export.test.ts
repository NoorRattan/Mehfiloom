import { describe, expect, it } from "vitest";
import { exportWorkspaceText } from "../lib/plan-export";
import { newBrief } from "../lib/events";
import { buildPlanResult, getEventTemplateProposal } from "../../backend/lib/planner";
import type { Workspace } from "../lib/workspace-store";

describe("portable planning export", () => {
  it("retains the complete AI proposal, caveats, revised brief and host work", () => {
    const result = buildPlanResult(getEventTemplateProposal("wedding"), "USD", 10000);
    const state: Workspace = {
      brief: {
        ...newBrief("wedding"),
        eventName: "A garden wedding",
        budgetAmount: "20000",
        currency: "INR",
        style: "Garden romance",
        mustHaves: "A quiet space and step-free entry",
      },
      result,
      resultSource: "ai",
      checked: ["Confirm step-free entry"],
      customTasks: ["Confirm step-free entry"],
      vendorNotes: { Venue: "Ramp confirmed in writing" },
      revisionRequests: ["Keep the quiet space"],
    };
    const text = exportWorkspaceText(state, [{ title: "Confirm step-free entry", timing: "Tomorrow" }], "₹20,000.00");
    expect(text).toContain("Current budget: ₹20,000.00");
    expect(text).toContain("BUDGET ALLOCATION (USD)");
    expect(text).toContain("Total allocated: $100");
    expect(text).toContain("[x] Confirm step-free entry — Tomorrow");
    expect(text).toContain(state.brief.mustHaves);
    expect(text).toContain("Ramp confirmed in writing");
    expect(text).toContain("1. Keep the quiet space");
    expect(text).toContain("Planning allocations are not vendor quotes");
    for (const value of [
      result.proposal.overview,
      result.proposal.theme,
      result.proposal.ideas[0].costNote,
      result.proposal.timeline[0].timing,
      result.proposal.vendorChecklist[0].questions[0],
      result.proposal.openQuestions[0],
      result.proposal.assumptions[0],
    ]) expect(text).toContain(value);
  });

  it("exports an unfinished draft without inventing an AI plan", () => {
    const text = exportWorkspaceText({
      brief: newBrief("community"), checked: [], customTasks: [], vendorNotes: {},
      result: null, resultSource: null, revisionRequests: [],
    }, [], "Set your budget");
    expect(text).toContain("My community gathering");
    expect(text).toContain("Date: To be decided");
    expect(text).not.toContain("AI PLANNING DRAFT");
    expect(text).not.toContain("undefined");
  });
});

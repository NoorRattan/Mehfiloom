import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import Organizer from "../components/organizer";
import BudgetEditor from "../components/budget-editor";
import {
  buildPlanResult,
  getEventTemplateProposal,
} from "../../backend/lib/planner";
import { eventKinds, events, newBrief } from "../lib/events";

describe("dedicated organizers", () => {
  it("merges AI timeline tasks once while preserving host completion and vendor notes", async () => {
    const user = userEvent.setup();
    const result = buildPlanResult(
      getEventTemplateProposal("community"),
      "INR",
      100000,
    );
    const task = result.proposal.timeline[0];
    window.localStorage.setItem(
      "mehfiloom:v2:community",
      JSON.stringify({
        brief: {
          ...newBrief("community"),
          eventName: "Our neighborhood table",
        },
        checked: [events.community.tasks[0]],
        customTasks: [task.task, "Call the access coordinator"],
        vendorNotes: {
          [result.proposal.vendorChecklist[0].category]:
            "Keep the side entrance available",
        },
        result,
        resultSource: "ai",
        revisionRequests: [],
      }),
    );
    render(<Organizer kind="community" />);
    await user.click(screen.getByRole("tab", { name: "The checklist" }));
    const imported = screen.getAllByRole("checkbox", {
      name: new RegExp(task.task),
    });
    expect(imported).toHaveLength(1);
    expect(imported[0].closest("label")).toHaveTextContent(task.timing);
    expect(
      screen.getByRole("checkbox", {
        name: new RegExp(events.community.tasks[0]),
      }),
    ).toBeChecked();
    await user.click(imported[0]);
    expect(imported[0]).toBeChecked();
    await user.click(imported[0]);
    expect(imported[0]).not.toBeChecked();
    await user.click(screen.getByRole("tab", { name: "Your vendors" }));
    const venue = screen.getByText(
      result.proposal.vendorChecklist[0].category,
      { selector: "summary", exact: false },
    );
    await user.click(venue);
    expect(
      within(venue.closest("details")!).getByRole("textbox", {
        name: "Your notes",
      }),
    ).toHaveValue("Keep the side entrance available");
  });

  it("recovers from an invalid budget, exports a copy and dismisses its notice", async () => {
    const user = userEvent.setup();
    const revoke = vi.fn();
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL() {
          return "blob:exported-plan";
        }
        static revokeObjectURL = revoke;
      },
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<Organizer kind="birthday" />);
    const budget = screen.getByRole("textbox", { name: "Budget amount" });
    fireEvent.change(budget, { target: { value: "0" } });
    await user.click(screen.getByRole("tab", { name: "Your budget" }));
    await user.click(
      screen.getByRole("button", { name: /Create a starter budget/ }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/budget/i);
    fireEvent.change(budget, { target: { value: "20000" } });
    await user.click(
      screen.getByRole("button", { name: /Create a starter budget/ }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Export plan" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your plan has been exported",
    );
    await user.click(
      screen.getByRole("button", { name: "Dismiss notification" }),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(revoke).toHaveBeenCalledWith("blob:exported-plan"),
    );
  });

  it("retains existing work while an invalid date and fractional attendance are being edited", () => {
    render(<Organizer kind="wedding" />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Celebration name" }),
      { target: { value: "Keep this draft" } },
    );
    fireEvent.change(screen.getByLabelText(/^Date/), {
      target: { value: "0002-10-29" },
    });
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Guest estimate" }),
      { target: { value: "1.5" } },
    );
    expect(screen.getByText(/A date to confirm/)).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Celebration name" }),
    ).toHaveValue("Keep this draft");
    expect(
      screen.getByRole("spinbutton", { name: "Guest estimate" }),
    ).toHaveValue(1.5);
    expect(screen.getByLabelText(/^Date/)).toHaveAttribute("min", "1900-01-01");
    fireEvent.change(screen.getByLabelText(/^Date/), {
      target: { value: "2027-03-14" },
    });
    expect(screen.getByText(/March.*2027/)).toBeInTheDocument();
  });

  it("keeps checklist input when a blank, duplicate or over-limit task is rejected", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      "mehfiloom:v2:wedding",
      JSON.stringify({
        brief: newBrief("wedding"),
        checked: [],
        customTasks: Array.from({ length: 50 }, (_, i) => `Custom task ${i}`),
        vendorNotes: {},
        result: null,
        resultSource: null,
        revisionRequests: [],
      }),
    );
    render(<Organizer kind="wedding" />);
    await user.click(screen.getByRole("tab", { name: "The checklist" }));
    const task = screen.getByRole("textbox", { name: "New checklist task" });
    await user.click(task);
    await user.paste("   ");
    await user.click(screen.getByRole("button", { name: "Add task" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "between 1 and 120 characters",
    );
    await user.clear(task);
    await user.paste(events.wedding.tasks[0]);
    await user.click(screen.getByRole("button", { name: "Add task" }));
    expect(screen.getByRole("alert")).toHaveTextContent("already on your list");
    await user.clear(task);
    await user.paste("One more practical task");
    await user.click(screen.getByRole("button", { name: "Add task" }));
    expect(screen.getByRole("alert")).toHaveTextContent("50 custom tasks");
    expect(task).toHaveValue("One more practical task");
  });

  it("protects a newer cross-tab allocation from an old budget editor", async () => {
    const user = userEvent.setup();
    render(<Organizer kind="wedding" />);
    await user.click(screen.getByRole("tab", { name: "Your budget" }));
    await user.click(
      screen.getByRole("button", { name: /Create a starter budget/ }),
    );
    await user.click(
      screen.getByRole("button", { name: /Adjust your allocations/ }),
    );
    const newer = buildPlanResult(
      getEventTemplateProposal("wedding"),
      "INR",
      100000,
    );
    act(() => {
      const draft = JSON.parse(
        window.localStorage.getItem("mehfiloom:v2:wedding")!,
      );
      window.localStorage.setItem(
        "mehfiloom:v2:wedding",
        JSON.stringify({ ...draft, result: newer }),
      );
      window.dispatchEvent(
        new StorageEvent("storage", { key: "mehfiloom:v2:wedding" }),
      );
    });
    await user.click(screen.getByRole("button", { name: /Save allocation/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "budget changed in another tab",
    );
    expect(
      JSON.parse(window.localStorage.getItem("mehfiloom:v2:wedding")!).result,
    ).toEqual(newer);
    await user.click(
      screen.getByRole("button", { name: "Keep the current allocation" }),
    );
    await user.click(
      screen.getByRole("button", { name: /Adjust your allocations/ }),
    );
    await user.click(screen.getByRole("button", { name: /Save allocation/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByText("Your budget allocation is updated."),
    ).toBeInTheDocument();
  });

  it("moves focus into the full checklist when its overview shortcut disappears", async () => {
    const user = userEvent.setup();
    render(<Organizer kind="wedding" />);
    await user.click(
      screen.getByRole("button", { name: /See the whole checklist/ }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("tabpanel", { name: "The checklist" }),
      ).toHaveFocus(),
    );
  });

  it("keeps the draft and reports an export failure", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL(): string {
          throw new Error("Downloads unavailable");
        }
      },
    );
    render(<Organizer kind="community" />);
    await user.type(
      screen.getByRole("textbox", { name: "Celebration name" }),
      "Our community table",
    );
    const before = window.localStorage.getItem("mehfiloom:v2:community");
    await user.click(screen.getByRole("button", { name: "Export plan" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "browser couldn’t export",
    );
    expect(window.localStorage.getItem("mehfiloom:v2:community")).toBe(before);
  });

  it("switches labeled sections with arrow keys, Home and End using one keyboard tab stop", async () => {
    const user = userEvent.setup();
    render(<Organizer kind="wedding" />);
    const overview = screen.getByRole("tab", { name: "The overview" });
    overview.focus();
    await user.keyboard("{ArrowRight}");
    const budget = screen.getByRole("tab", { name: "Your budget" });
    expect(budget).toHaveFocus();
    expect(budget).toHaveAttribute("aria-selected", "true");
    expect(overview).toHaveAttribute("tabindex", "-1");
    expect(
      screen.getByRole("tabpanel", { name: "Your budget" }),
    ).toBeInTheDocument();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Your vendors" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(overview).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Your vendors" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(overview).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("tabpanel", { name: "The overview" }),
    ).toHaveFocus();
  });

  it("recalculating closes a stale budget editor and uses the new cap", async () => {
    const user = userEvent.setup();
    render(<Organizer kind="wedding" />);
    await user.click(screen.getByRole("tab", { name: "Your budget" }));
    await user.click(
      screen.getByRole("button", { name: /Create a starter budget/ }),
    );
    await user.click(
      screen.getByRole("button", { name: /Adjust your allocations/ }),
    );
    const amount = screen.getByRole("textbox", { name: "Budget amount" });
    await user.clear(amount);
    await user.type(amount, "1000");
    await user.click(
      screen.getByRole("button", {
        name: /Recalculate using your current budget/,
      }),
    );
    expect(
      screen.queryByRole("button", { name: /Save allocation/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Budget allocations" }),
    ).toHaveTextContent("₹1,000");
    await user.click(
      screen.getByRole("button", { name: /Adjust your allocations/ }),
    );
    expect(
      screen.getByText("Every little bit accounted for."),
    ).toBeInTheDocument();
  });

  it.each(eventKinds)(
    "%s supports editing, tasks, budget and vendor notes without AI",
    async (kind) => {
      const user = userEvent.setup();
      const { unmount } = render(<Organizer kind={kind} />);
      const name = screen.getByRole("textbox", { name: "Celebration name" });
      await user.type(name, "Our celebration");
      await user.click(screen.getByRole("tab", { name: "The checklist" }));
      await user.type(
        screen.getByRole("textbox", { name: "New checklist task" }),
        "Arrange step-free arrival",
      );
      await user.click(screen.getByRole("button", { name: "Add task" }));
      await user.click(
        screen.getByRole("checkbox", { name: /Arrange step-free arrival/ }),
      );
      await user.click(screen.getByRole("tab", { name: "Your budget" }));
      await user.click(
        screen.getByRole("button", { name: /Create a starter budget/ }),
      );
      expect(
        screen.getByRole("table", { name: "Budget allocations" }),
      ).toBeInTheDocument();
      expect(
        (
          await axe.run(
            screen.getByRole("table", { name: "Budget allocations" }),
            { rules: { "color-contrast": { enabled: false } } },
          )
        ).violations,
      ).toEqual([]);
      expect(screen.getByText(/Your starter allocation/)).toBeInTheDocument();
      await user.click(screen.getByRole("tab", { name: "Your vendors" }));
      const summary = screen
        .getByText(getEventTemplateProposal(kind).vendorChecklist[0].category, {
          selector: "summary",
          exact: false,
        })
        .closest("details")!;
      await user.click(summary.querySelector("summary")!);
      await user.type(
        within(summary).getByRole("textbox", { name: "Your notes" }),
        "Ask about step-free entry",
      );
      unmount();
      render(<Organizer kind={kind} />);
      expect(
        screen.getByRole("textbox", { name: "Celebration name" }),
      ).toHaveValue("Our celebration");
      await user.click(screen.getByRole("tab", { name: "The checklist" }));
      expect(
        screen.getByRole("checkbox", { name: /Arrange step-free arrival/ }),
      ).toBeChecked();
    },
  );

  it.each(eventKinds)(
    "%s exposes labelled controls and has no axe semantic violations",
    async (kind) => {
      const { container } = render(<Organizer kind={kind} />);
      const results = await axe.run(container, {
        rules: { "color-contrast": { enabled: false } },
      });
      expect(
        results.violations.map(({ id, nodes }) => ({
          id,
          targets: nodes.map((n) => n.target),
        })),
      ).toEqual([]);
    },
  );
});

it("budget edits reject overspending and save an exactly reconciled allocation", async () => {
  const user = userEvent.setup();
  const result = buildPlanResult(
    getEventTemplateProposal("wedding"),
    "INR",
    10000,
  );
  const onSave = vi.fn();
  render(<BudgetEditor result={result} onSave={onSave} onCancel={vi.fn()} />);
  const first = screen.getAllByRole("textbox")[0];
  const original = first.getAttribute("value")!;
  await user.clear(first);
  await user.type(first, "1000");
  await user.click(screen.getByRole("button", { name: /Save allocation/ }));
  expect(screen.getByRole("alert")).toHaveTextContent(/need to add up/);
  expect(onSave).not.toHaveBeenCalled();
  await user.clear(first);
  await user.type(first, original);
  await user.click(screen.getByRole("button", { name: /Save allocation/ }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ allocatedMinor: 10000, totalMinor: 10000 }),
  );
});

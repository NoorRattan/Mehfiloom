import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import Organizer from "../components/organizer";
import BudgetEditor from "../components/budget-editor";
import {
  buildPlanResult,
  getEventTemplateProposal,
} from "../../backend/lib/planner";
import { eventKinds } from "../lib/events";

describe("dedicated organizers", () => {
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
    expect(screen.getByRole("tabpanel", { name: "Your budget" })).toBeInTheDocument();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Your vendors" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(overview).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Your vendors" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(overview).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("tabpanel", { name: "The overview" })).toHaveFocus();
  });

  it("recalculating closes a stale budget editor and uses the new cap", async () => {
    const user = userEvent.setup();
    render(<Organizer kind="wedding" />);
    await user.click(screen.getByRole("tab", { name: "Your budget" }));
    await user.click(screen.getByRole("button", { name: /Create a starter budget/ }));
    await user.click(screen.getByRole("button", { name: /Adjust your allocations/ }));
    const amount = screen.getByRole("textbox", { name: "Budget amount" });
    await user.clear(amount);
    await user.type(amount, "1000");
    await user.click(screen.getByRole("button", { name: /Recalculate using your current budget/ }));
    expect(screen.queryByRole("button", { name: /Save allocation/ })).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Budget allocations" })).toHaveTextContent("₹1,000");
    await user.click(screen.getByRole("button", { name: /Adjust your allocations/ }));
    expect(screen.getByText("Every little bit accounted for.")).toBeInTheDocument();
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

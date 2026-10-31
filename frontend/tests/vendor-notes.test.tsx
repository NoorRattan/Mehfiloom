import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import OrganizerVendors from "../components/organizer-vendors";

it("keeps earlier vendor notes visible and editable when AI changes categories", async () => {
  const user = userEvent.setup();
  const onChangeNote = vi.fn();
  render(
    <OrganizerVendors
      vendors={[
        {
          category: "Garden venue",
          questions: ["Is step-free access available?"],
        },
      ]}
      notes={{ "Earlier ceremony venue": "Ask about the indoor rain backup" }}
      onChangeNote={onChangeNote}
    />,
  );
  const summary = screen.getByText("Earlier ceremony venue", {
    selector: "summary",
    exact: false,
  });
  await user.click(summary);
  const earlier = within(summary.closest("details")!);
  expect(earlier.getByText("Saved notes from an earlier plan.")).toBeVisible();
  const field = earlier.getByRole("textbox", { name: "Your notes" });
  expect(field).toHaveValue("Ask about the indoor rain backup");
  await user.clear(field);
  expect(onChangeNote).toHaveBeenLastCalledWith("Earlier ceremony venue", "");
  expect(
    screen.getByText("Garden venue", { selector: "summary", exact: false }),
  ).toBeVisible();
});

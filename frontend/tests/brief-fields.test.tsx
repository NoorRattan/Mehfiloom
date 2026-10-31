import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import BriefFields from "../components/brief-fields";
import { events, newBrief } from "../lib/events";

function BriefEditor() {
  const [brief, setBrief] = useState(newBrief("birthday"));
  return (
    <>
      <BriefFields
        kind="birthday"
        brief={brief}
        onChange={(key, value) =>
          setBrief((current) => ({ ...current, [key]: value }))
        }
      />
      <output data-testid="brief">{JSON.stringify(brief)}</output>
    </>
  );
}

it("edits every brief control with typed values and allows style suggestions to be refined", async () => {
  const user = userEvent.setup();
  render(<BriefEditor />);
  await user.type(
    screen.getByRole("textbox", { name: "Celebration name" }),
    "A relaxed birthday",
  );
  await user.type(
    screen.getByRole("textbox", { name: "City or location" }),
    "Jaipur",
  );
  fireEvent.change(screen.getByLabelText(/^Date/), {
    target: { value: "2027-03-14" },
  });
  const guests = screen.getByRole("spinbutton", { name: "Guest estimate" });
  await user.clear(guests);
  await user.type(guests, "45");
  const budget = screen.getByRole("textbox", { name: "Budget amount" });
  await user.clear(budget);
  await user.type(budget, "1234.50");
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Budget currency" }),
    "EUR",
  );
  const style = screen.getByRole("textbox", {
    name: "The feeling you’re going for",
  });
  expect(style).toHaveAttribute("rows", "3");
  await user.type(style, "Quiet and personal");
  const suggestion = screen.getByRole("button", {
    name: events.birthday.styles[0],
  });
  await user.click(suggestion);
  expect(suggestion).toHaveAttribute("aria-pressed", "true");
  await user.type(style, " with a quiet corner");
  expect(suggestion).toHaveAttribute("aria-pressed", "false");
  await user.type(
    screen.getByRole("textbox", { name: /Must-haves/ }),
    "Step-free entry",
  );
  expect(JSON.parse(screen.getByTestId("brief").textContent!)).toMatchObject({
    eventType: "birthday",
    eventName: "A relaxed birthday",
    location: "Jaipur",
    eventDate: "2027-03-14",
    guestCount: 45,
    budgetAmount: "1234.50",
    currency: "EUR",
    style: `${events.birthday.styles[0]} with a quiet corner`,
    mustHaves: "Step-free entry",
  });
});

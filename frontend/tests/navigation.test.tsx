import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { Header } from "../components/chrome";

it("mobile navigation keeps keyboard focus within its controls and restores it on Escape", async () => {
  const user = userEvent.setup();
  render(<Header kind="wedding" />);
  const toggle = screen.getByRole("button", { name: "Open navigation" });
  await user.click(toggle);
  const menu = screen.getByRole("navigation", { name: "Mobile navigation" });
  const links = within(menu).getAllByRole("link");
  await user.tab();
  expect(links[0]).toHaveFocus();
  await user.tab({ shift: true });
  expect(toggle).toHaveFocus();
  await user.tab({ shift: true });
  expect(links.at(-1)).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(
    screen.queryByRole("navigation", { name: "Mobile navigation" }),
  ).not.toBeInTheDocument();
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAttribute("aria-expanded", "false");
});

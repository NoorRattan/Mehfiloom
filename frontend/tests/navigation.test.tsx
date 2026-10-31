import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { EventNav, Footer, Header } from "../components/chrome";
import { eventKinds } from "../lib/events";

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
  await user.tab();
  expect(toggle).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(
    screen.queryByRole("navigation", { name: "Mobile navigation" }),
  ).not.toBeInTheDocument();
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAttribute("aria-expanded", "false");
});

it.each(["Weddings", "Our approach", "Start planning"])(
  "closes mobile navigation after activating %s",
  async (name) => {
    const user = userEvent.setup();
    render(<Header />);
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    const menu = screen.getByRole("navigation", { name: "Mobile navigation" });
    // Next's router is mocked here; suppress jsdom document navigation only.
    menu.addEventListener("click", (event) => event.preventDefault());
    await user.click(within(menu).getByRole("link", { name }));
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open navigation" }),
    ).toHaveAttribute("aria-expanded", "false");
  },
);

it.each(eventKinds)(
  "%s workspace navigation exposes the selected page and preserves its event routes",
  (kind) => {
    const { rerender } = render(<EventNav kind={kind} active="explore" />);
    expect(
      screen.getByRole("link", { name: "The inspiration" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "The inspiration" }),
    ).toHaveAttribute("href", `/${kind}`);
    rerender(<EventNav kind={kind} active="organize" />);
    expect(
      screen.getByRole("link", { name: "Your organizer" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Your organizer" }),
    ).toHaveAttribute("href", `/${kind}/organize`);
    expect(
      screen.getByRole("link", { name: "The inspiration" }),
    ).not.toHaveAttribute("aria-current");
    rerender(<EventNav kind={kind} active="assist" />);
    expect(
      screen.getByRole("link", { name: "Your AI assistant" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Your AI assistant" }),
    ).toHaveAttribute("href", `/${kind}/assist`);
  },
);

it("footer offers both general and event-specific planning entry points", () => {
  const { rerender } = render(<Footer />);
  const footer = screen.getByRole("contentinfo");
  expect(
    within(footer).getByRole("link", { name: "Make something memorable" }),
  ).toHaveAttribute("href", "/#celebrations");
  expect(
    within(footer).getByRole("link", { name: "Back to top ↑" }),
  ).toHaveAttribute("href", "#top");
  rerender(<Footer kind="birthday" />);
  expect(
    screen.getByRole("link", { name: "Make something memorable" }),
  ).toHaveAttribute("href", "/birthday/organize");
});

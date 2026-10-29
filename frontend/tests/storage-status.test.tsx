import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import Organizer from "../components/organizer";
import Assistant from "../components/assistant";

it.each([
  ["organizer", Organizer],
  ["assistant", Assistant],
] as const)("%s explains temporary storage and recovers when writes become available", async (_name, Component) => {
  const user = userEvent.setup();
  render(<Component kind="wedding" />);
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage is blocked", "SecurityError");
  });
  const name = screen.getByRole("textbox", { name: "Celebration name" });
  await user.type(name, "My celebration");
  expect(await screen.findByRole("status")).toHaveTextContent("Changes are kept only in this tab");
  expect(screen.getByRole("status")).toHaveTextContent("Export a copy before leaving or closing this tab");
  expect(screen.getByRole("link", { name: "Open your organizer to export a copy" })).toHaveAttribute("href", "/wedding/organize");
  expect(screen.queryByText(/Stored on this browser/)).not.toBeInTheDocument();
  expect(name).toHaveValue("My celebration");
  write.mockRestore();
  await user.type(name, "!");
  expect(screen.queryByText(/Changes are kept only in this tab/)).not.toBeInTheDocument();
  expect(screen.getByText(/Stored on this browser/)).toBeInTheDocument();
});

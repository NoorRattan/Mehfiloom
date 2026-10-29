import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Sculpture from "../components/sculpture";

vi.mock("next/dynamic", () => ({
  default: () => function Scene({ spin }: { spin: number }) {
    return <div data-testid="webgl-scene">{spin}</div>;
  },
}));

function observeScene({ reduced = false, mobile = false } = {}) {
  const reducedMotion = new EventTarget();
  const smallScreen = new EventTarget();
  const motion = Object.assign(reducedMotion, { matches: reduced });
  const screenSize = Object.assign(smallScreen, { matches: mobile });
  vi.spyOn(window, "matchMedia").mockImplementation((query) =>
    (query.includes("prefers-reduced-motion") ? motion : screenSize) as unknown as MediaQueryList,
  );
  let callback!: IntersectionObserverCallback;
  const disconnect = vi.fn();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(onIntersect: IntersectionObserverCallback) { callback = onIntersect; }
    observe = vi.fn();
    disconnect = disconnect;
  });
  const intersect = (isIntersecting: boolean) => act(() => callback(
    [{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver,
  ));
  const setReduced = (value: boolean) => act(() => {
    motion.matches = value;
    motion.dispatchEvent(new Event("change"));
  });
  const setMobile = (value: boolean) => act(() => {
    screenSize.matches = value;
    screenSize.dispatchEvent(new Event("change"));
  });
  return { intersect, setReduced, setMobile, disconnect, motion, screenSize };
}

describe("decorative sculpture resource lifecycle", () => {
  it("runs only near the viewport and stops when hidden, resized or motion preferences change", async () => {
    const user = userEvent.setup();
    const scene = observeScene();
    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const { unmount } = render(<Sculpture />);
    expect(screen.queryByTestId("webgl-scene")).not.toBeInTheDocument();
    scene.intersect(true);
    expect(screen.getByTestId("webgl-scene")).toHaveTextContent("0");
    await user.click(screen.getByRole("button", { name: /A little twist of joy/ }));
    expect(screen.getByTestId("webgl-scene")).toHaveTextContent("1");
    scene.setReduced(true);
    expect(screen.queryByTestId("webgl-scene")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /A little twist of joy/ })).not.toBeInTheDocument();
    scene.setReduced(false);
    expect(screen.getByTestId("webgl-scene")).toBeInTheDocument();
    scene.setMobile(true);
    expect(screen.queryByTestId("webgl-scene")).not.toBeInTheDocument();
    scene.setMobile(false);
    hidden.mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.queryByTestId("webgl-scene")).not.toBeInTheDocument();
    hidden.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByTestId("webgl-scene")).toBeInTheDocument();
    scene.intersect(false);
    expect(screen.queryByTestId("webgl-scene")).not.toBeInTheDocument();
    unmount();
    expect(scene.disconnect).toHaveBeenCalledOnce();
  });

  it.each([{ reduced: true }, { mobile: true }])("keeps the static fallback initially for %j", (preferences) => {
    const scene = observeScene(preferences);
    const { container } = render(<Sculpture />);
    scene.intersect(true);
    expect(screen.queryByTestId("webgl-scene")).not.toBeInTheDocument();
    expect(container.querySelector(".sculpture-fallback")).toBeInTheDocument();
  });

  it("keeps a static fallback when intersection observation is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<Sculpture />);
    expect(container.querySelector(".sculpture-fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("webgl-scene")).not.toBeInTheDocument();
  });
});

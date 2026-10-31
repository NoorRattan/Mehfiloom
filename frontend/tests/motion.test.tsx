import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { Magnetic, MotionProvider, Reveal } from "../components/motion";

const effects = vi.hoisted(() => ({
  startScrolling: vi.fn(),
  stopScrolling: vi.fn(),
  animate: vi.fn(),
  reset: vi.fn(),
  stopAnimation: vi.fn(),
}));
vi.unmock("../components/motion");
vi.mock("lenis", () => ({
  default: class {
    constructor(options: unknown) {
      effects.startScrolling(options);
    }
    destroy() {
      effects.stopScrolling();
    }
  },
}));
vi.mock("gsap", () => ({
  default: {
    to: effects.animate,
    set: effects.reset,
    killTweensOf: effects.stopAnimation,
  },
}));
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      className,
    }: {
      children: ReactNode;
      className?: string;
    }) => <div className={className}>{children}</div>,
  },
  MotionConfig: ({ children }: { children: ReactNode }) => children,
  useReducedMotion: () => false,
}));

function preferences(reduced = false) {
  const query = Object.assign(new EventTarget(), { matches: reduced });
  vi.spyOn(window, "matchMedia").mockReturnValue(
    query as unknown as MediaQueryList,
  );
  const setReduced = (value: boolean) =>
    act(() => {
      query.matches = value;
      query.dispatchEvent(new Event("change"));
    });
  const setVisibility = (value: DocumentVisibilityState) =>
    act(() => {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue(value);
      document.dispatchEvent(new Event("visibilitychange"));
    });
  return { setReduced, setVisibility };
}

afterEach(() => vi.clearAllMocks());

describe("motion lifecycle", () => {
  it("stops smooth scrolling when motion is reduced or the tab is hidden, and cleans up listeners", () => {
    const { setReduced, setVisibility } = preferences();
    const { unmount } = render(
      <MotionProvider>
        <button>Plan an event</button>
      </MotionProvider>,
    );
    expect(effects.startScrolling).toHaveBeenCalledTimes(1);
    setReduced(true);
    expect(effects.stopScrolling).toHaveBeenCalledTimes(1);
    setReduced(false);
    expect(effects.startScrolling).toHaveBeenCalledTimes(2);
    setVisibility("hidden");
    expect(effects.stopScrolling).toHaveBeenCalledTimes(2);
    setVisibility("visible");
    expect(effects.startScrolling).toHaveBeenCalledTimes(3);
    unmount();
    expect(effects.stopScrolling).toHaveBeenCalledTimes(3);
    setReduced(false);
    setVisibility("visible");
    expect(effects.startScrolling).toHaveBeenCalledTimes(3);
  });

  it("retains readable content and native scrolling when reduced motion is already enabled", () => {
    preferences(true);
    render(
      <MotionProvider>
        <Reveal>
          <h1>Your celebration</h1>
        </Reveal>
      </MotionProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "Your celebration" }),
    ).toBeVisible();
    expect(effects.startScrolling).not.toHaveBeenCalled();
  });

  it("resets an active magnetic transform immediately when reduced motion is enabled", () => {
    const { setReduced } = preferences();
    const { unmount } = render(
      <Magnetic>
        <a href="/wedding">Start planning</a>
      </Magnetic>,
    );
    const element = screen.getByRole("link", {
      name: "Start planning",
    }).parentElement!;
    const pointer = new MouseEvent("pointermove", {
      bubbles: true,
      clientX: 20,
      clientY: 10,
    });
    Object.defineProperty(pointer, "pointerType", { value: "mouse" });
    fireEvent(element, pointer);
    expect(effects.animate).toHaveBeenCalledTimes(1);
    setReduced(true);
    expect(effects.stopAnimation).toHaveBeenCalledWith(element);
    expect(effects.reset).toHaveBeenCalledWith(element, { x: 0, y: 0 });
    fireEvent(element, pointer);
    expect(effects.animate).toHaveBeenCalledTimes(1);
    unmount();
    expect(effects.stopAnimation).toHaveBeenCalledTimes(2);
  });

  it("does not apply mouse magnetism to a touch gesture", () => {
    preferences();
    render(
      <Magnetic>
        <button>Start planning</button>
      </Magnetic>,
    );
    const element = screen.getByRole("button", {
      name: "Start planning",
    }).parentElement!;
    const pointer = new MouseEvent("pointermove", { bubbles: true });
    Object.defineProperty(pointer, "pointerType", { value: "touch" });
    fireEvent(element, pointer);
    expect(effects.animate).not.toHaveBeenCalled();
  });
});

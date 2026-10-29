import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import Assistant from "../components/assistant";
import { eventKinds, newBrief, type EventKind } from "../lib/events";
import {
  buildPlanResult,
  getEventTemplateProposal,
} from "../../backend/lib/planner";
import type { Workspace } from "../lib/workspace-store";

function seed(kind: EventKind) {
  const state: Workspace = {
    brief: {
      ...newBrief(kind),
      eventName: "Our thoughtful celebration",
      location: "Chandigarh",
    },
    checked: ["Arrange step-free arrival"],
    customTasks: ["Arrange step-free arrival"],
    vendorNotes: { Venue: "Ask about the ramp" },
    result: null,
    resultSource: null,
    revisionRequests: [],
  };
  window.localStorage.setItem(`mehfiloom:v2:${kind}`, JSON.stringify(state));
  return state;
}

describe("dedicated assistants", () => {
  it("admits one request, cancels it, and preserves the saved draft", async () => {
    const user = userEvent.setup();
    const initial = seed("wedding");
    let signal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, options: RequestInit) => {
      signal = options.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        signal!.addEventListener("abort", () => reject(signal!.reason), { once: true });
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<Assistant kind="wedding" />);
    const composer = screen.getByRole("button", { name: "Create your tailored plan" }).closest("form")!;
    act(() => {
      fireEvent.submit(composer);
      fireEvent.submit(composer);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Cancel planning" }));
    expect(signal?.aborted).toBe(true);
    expect(await screen.findByRole("status")).toHaveTextContent("Planning cancelled");
    expect(screen.getByRole("button", { name: "Create your tailored plan" })).toBeEnabled();
    expect(JSON.parse(window.localStorage.getItem("mehfiloom:v2:wedding")!)).toEqual(initial);
  });

  it("does not overwrite a newer browser draft with a pending response", async () => {
    const user = userEvent.setup();
    const initial = seed("birthday");
    const result = buildPlanResult(getEventTemplateProposal("birthday"), "INR", 100000);
    let respond!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { respond = resolve; })));
    render(<Assistant kind="birthday" />);
    await user.click(screen.getByRole("button", { name: "Create your tailored plan" }));
    const newer = { ...initial, brief: { ...initial.brief, location: "Jaipur" } };
    act(() => {
      window.localStorage.setItem("mehfiloom:v2:birthday", JSON.stringify(newer));
      window.dispatchEvent(new StorageEvent("storage", { key: "mehfiloom:v2:birthday" }));
      respond(Response.json({ result }));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Your draft changed");
    expect(JSON.parse(window.localStorage.getItem("mehfiloom:v2:birthday")!)).toEqual(newer);
  });

  it("aborts on navigation and ignores a provider that resolves after unmount", async () => {
    const user = userEvent.setup();
    const initial = seed("community");
    let respond!: (response: Response) => void;
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) => {
      signal = options.signal as AbortSignal;
      return new Promise<Response>((resolve) => { respond = resolve; });
    }));
    const { unmount } = render(<Assistant kind="community" />);
    await user.click(screen.getByRole("button", { name: "Create your tailored plan" }));
    unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => respond(Response.json({
      result: buildPlanResult(getEventTemplateProposal("community"), "INR", 100000),
    })));
    expect(JSON.parse(window.localStorage.getItem("mehfiloom:v2:community")!)).toEqual(initial);
  });

  it.each([null, [], { result: null }])("handles an invalid successful JSON envelope safely: %j", async (payload) => {
    const user = userEvent.setup();
    seed("wedding");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
    render(<Assistant kind="wedding" />);
    await user.click(screen.getByRole("button", { name: "Create your tailored plan" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("incomplete plan");
    expect(screen.getByRole("button", { name: "Create your tailored plan" })).toBeEnabled();
  });

  it("explains a non-JSON service error without exposing parser internals", async () => {
    const user = userEvent.setup();
    seed("wedding");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Upstream unavailable</html>", { status: 502 })));
    render(<Assistant kind="wedding" />);
    await user.click(screen.getByRole("button", { name: "Create your tailored plan" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("unreadable response. Your draft is safe");
    expect(screen.queryByText(/Unexpected token/)).not.toBeInTheDocument();
  });

  it.each(eventKinds)(
    "%s sends its own brief, preserves work on failure and carries revisions forward",
    async (kind) => {
      const user = userEvent.setup();
      const initial = seed(kind);
      const result = buildPlanResult(
        getEventTemplateProposal(kind),
        initial.brief.currency,
        100000,
      );
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(Response.json({ result }))
        .mockResolvedValueOnce(
          Response.json(
            {
              error: {
                message: "The service is busy; your brief is unchanged.",
              },
            },
            { status: 503 },
          ),
        )
        .mockResolvedValueOnce(Response.json({ result }));
      vi.stubGlobal("fetch", fetchMock);
      render(<Assistant kind={kind} />);
      const prompt = screen.getByRole("textbox", {
        name: "Describe your celebration or request a change",
      });
      await user.type(prompt, "Keep a quiet area and step-free arrival.");
      await user.click(
        screen.getByRole("button", { name: "Create your tailored plan" }),
      );
      expect(
        await screen.findByRole("heading", {
          name: result.proposal.conceptTitle,
        }),
      ).toBeInTheDocument();
      const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sent.brief.eventType).toBe(kind);
      expect(sent.revisionRequest).toBe(
        "Keep a quiet area and step-free arrival.",
      );
      expect(sent.priorRevisionRequests).toEqual([]);
      expect(
        screen.getByRole("link", { name: /Open your plan in the organizer/ }),
      ).toHaveAttribute("href", `/${kind}/organize`);
      await user.type(
        prompt,
        "Keep the quiet area and simplify the decorations.",
      );
      await user.click(
        screen.getByRole("button", { name: "Create your tailored plan" }),
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "service is busy",
      );
      expect(
        screen.getByRole("heading", { name: result.proposal.conceptTitle }),
      ).toBeInTheDocument();
      expect(prompt).toHaveValue(
        "Keep the quiet area and simplify the decorations.",
      );
      await user.click(
        screen.getByRole("button", { name: "Create your tailored plan" }),
      );
      expect(await screen.findByRole("status")).toHaveTextContent(
        "tailored plan is ready",
      );
      const revision = JSON.parse(fetchMock.mock.calls[2][1].body);
      expect(revision.priorRevisionRequests).toEqual([
        "Keep a quiet area and step-free arrival.",
      ]);
      const stored: Workspace = JSON.parse(
        window.localStorage.getItem(`mehfiloom:v2:${kind}`)!,
      );
      expect(stored.checked).toEqual(initial.checked);
      expect(stored.vendorNotes).toEqual(initial.vendorNotes);
      expect(stored.revisionRequests).toHaveLength(2);
      expect(stored.resultSource).toBe("ai");
    },
  );

  it("rejects an incomplete provider result without overwriting the saved plan", async () => {
    const user = userEvent.setup();
    const state = seed("wedding");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ result: { currency: "INR", totalMinor: 1000 } }),
        ),
    );
    render(<Assistant kind="wedding" />);
    await user.click(
      screen.getByRole("button", { name: "Create your tailored plan" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "incomplete plan",
    );
    expect(
      JSON.parse(window.localStorage.getItem("mehfiloom:v2:wedding")!).brief,
    ).toEqual(state.brief);
  });

  it("does not send an incomplete brief to the provider", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<Assistant kind="birthday" />);
    await user.click(
      screen.getByRole("button", { name: "Create your tailored plan" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("little details first");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts a fresh planning round at the revision limit while retaining host work", async () => {
    const user = userEvent.setup();
    const state = seed("community");
    state.revisionRequests = Array.from(
      { length: 20 },
      (_, i) => `Keep the quiet area, revision ${i}.`,
    );
    window.localStorage.setItem(
      "mehfiloom:v2:community",
      JSON.stringify(state),
    );
    render(<Assistant kind="community" />);
    await user.click(
      screen.getByRole("button", { name: "Start a fresh planning round" }),
    );
    const saved: Workspace = JSON.parse(
      window.localStorage.getItem("mehfiloom:v2:community")!,
    );
    expect(saved.revisionRequests).toEqual([]);
    expect(saved.brief).toEqual(state.brief);
    expect(saved.checked).toEqual(state.checked);
    expect(saved.vendorNotes).toEqual(state.vendorNotes);
    expect(screen.getByRole("status")).toHaveTextContent(
      "fresh planning round",
    );
  });

  it.each(eventKinds)(
    "%s assistant has no axe semantic violations",
    async (kind) => {
      const { container } = render(<Assistant kind={kind} />);
      const { violations } = await axe.run(container, {
        rules: { "color-contrast": { enabled: false } },
      });
      expect(
        violations.map(({ id, nodes }) => ({
          id,
          targets: nodes.map((n) => n.target),
        })),
      ).toEqual([]);
    },
  );
});

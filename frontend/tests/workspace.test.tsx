import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWorkspace } from "../lib/workspace-store";

describe("browser draft persistence", () => {
  it("keeps incomplete typing and independent event drafts through remounts", () => {
    const wedding = renderHook(() => useWorkspace("wedding"));
    const birthday = renderHook(() => useWorkspace("birthday"));
    act(() =>
      wedding.result.current.update((s) => ({
        ...s,
        brief: {
          ...s.brief,
          eventName: "A",
          location: "",
          budgetAmount: "",
          guestCount: 0,
        },
      })),
    );
    expect(wedding.result.current.state.brief.eventName).toBe("A");
    expect(birthday.result.current.state.brief.eventName).toBe("");
    wedding.unmount();
    const restored = renderHook(() => useWorkspace("wedding"));
    expect(restored.result.current.state.brief).toMatchObject({
      eventName: "A",
      budgetAmount: "",
      guestCount: 0,
    });
  });

  it.each(["{", JSON.stringify({ brief: { eventType: "birthday" } })])(
    "recovers from damaged or mismatched saved data: %s",
    (value) => {
      window.localStorage.setItem("mehfiloom:v2:wedding", value);
      const { result } = renderHook(() => useWorkspace("wedding"));
      expect(result.current.state.brief.eventType).toBe("wedding");
      act(() =>
        result.current.update((s) => ({
          ...s,
          brief: { ...s.brief, eventName: "Recovered draft" },
        })),
      );
      expect(
        JSON.parse(window.localStorage.getItem("mehfiloom:v2:wedding")!).brief
          .eventName,
      ).toBe("Recovered draft");
    },
  );

  it("retains edits when storage is denied, then recovers persistence", () => {
    const { result } = renderHook(() => useWorkspace("community"));
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });
    act(() =>
      result.current.update((s) => ({
        ...s,
        customTasks: ["Book accessible transport"],
      })),
    );
    expect(result.current.state.customTasks).toEqual([
      "Book accessible transport",
    ]);
    write.mockRestore();
    act(() =>
      result.current.update((s) => ({
        ...s,
        checked: ["Book accessible transport"],
      })),
    );
    expect(
      JSON.parse(window.localStorage.getItem("mehfiloom:v2:community")!)
        .customTasks,
    ).toEqual(["Book accessible transport"]);
  });
});

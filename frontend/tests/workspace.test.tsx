import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWorkspace, planResultSchema } from "../lib/workspace-store";
import {
  buildPlanResult,
  getEventTemplateProposal,
} from "../../backend/lib/planner";

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

  it("retains temporary date, timezone, and numeric edits without erasing host work", () => {
    const workspace = renderHook(() => useWorkspace("wedding"));
    act(() =>
      workspace.result.current.update((state) => ({
        ...state,
        brief: {
          ...state.brief,
          eventName: "Keep my celebration",
          location: "Chandigarh",
        },
        customTasks: ["Keep this host task"],
        vendorNotes: { Venue: "Keep this venue note" },
      })),
    );
    for (const briefEdit of [
      { guestCount: -1 },
      { guestCount: 1.5 },
      { eventDate: "0002-02-14" },
      { timeZone: "Asia/", eventTime: "10:30" },
      { eventDate: "", eventTime: "10:30" },
    ]) {
      act(() =>
        workspace.result.current.update((state) => ({
          ...state,
          brief: { ...state.brief, ...briefEdit },
        })),
      );
      expect(workspace.result.current.state.brief).toMatchObject({
        eventName: "Keep my celebration",
        location: "Chandigarh",
        ...briefEdit,
      });
      expect(workspace.result.current.state.customTasks).toEqual([
        "Keep this host task",
      ]);
      expect(workspace.result.current.state.vendorNotes).toEqual({
        Venue: "Keep this venue note",
      });
    }
    workspace.unmount();
    const restored = renderHook(() => useWorkspace("wedding"));
    expect(restored.result.current.state.brief.eventName).toBe(
      "Keep my celebration",
    );
    expect(restored.result.current.state.brief.timeZone).toBe("Asia/");
  });

  it("retains spaces in unfinished style and must-have sentences", () => {
    const { result } = renderHook(() => useWorkspace("wedding"));
    for (const [style, mustHaves] of [
      ["Quiet ", "Step-free "],
      ["Quiet garden ", "Step-free entrance "],
    ]) {
      act(() =>
        result.current.update((state) => ({
          ...state,
          brief: { ...state.brief, style, mustHaves },
        })),
      );
      expect(result.current.state.brief.style).toBe(style);
      expect(result.current.state.brief.mustHaves).toBe(mustHaves);
    }
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
    expect(result.current.storageStatus).toBe("temporary");
    const secondView = renderHook(() => useWorkspace("community"));
    expect(secondView.result.current.state.customTasks).toEqual([
      "Book accessible transport",
    ]);
    expect(secondView.result.current.storageStatus).toBe("temporary");
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
    expect(result.current.storageStatus).toBe("persistent");
    expect(secondView.result.current.storageStatus).toBe("persistent");
  });
});

describe("saved allocation integrity", () => {
  function allocation() {
    return buildPlanResult(getEventTemplateProposal("wedding"), "INR", 100000);
  }

  it("accepts exact host reallocations and rejects duplicate or mismatched categories", () => {
    const result = allocation();
    const edited = structuredClone(result);
    edited.lines[0].amountMinor += 1;
    edited.lines[1].amountMinor -= 1;
    expect(planResultSchema.safeParse(edited).success).toBe(true);

    const duplicate = structuredClone(result);
    duplicate.lines[1].category = duplicate.lines[0].category;
    expect(planResultSchema.safeParse(duplicate).success).toBe(false);
    const mismatched = structuredClone(result);
    mismatched.lines[0].weight += 1;
    expect(planResultSchema.safeParse(mismatched).success).toBe(false);
    const missingReserve = structuredClone(result);
    const reserve = missingReserve.proposal.budgetAllocations.find(
      (line) => line.category === "contingency",
    )!;
    reserve.category = "other";
    expect(planResultSchema.safeParse(missingReserve).success).toBe(false);
  });

  it("normalizes stored proposal and line text together without losing manual allocations", () => {
    const saved = allocation();
    saved.proposal.budgetAllocations[0].rationale = `  ${saved.proposal.budgetAllocations[0].rationale}  `;
    saved.lines[0].rationale = saved.proposal.budgetAllocations[0].rationale;
    saved.lines[0].amountMinor += 1;
    saved.lines[1].amountMinor -= 1;
    saved.currency = " inr ";
    const parsed = planResultSchema.parse(saved);
    expect(parsed.currency).toBe("INR");
    expect(parsed.lines[0].rationale).toBe(saved.lines[0].rationale.trim());
    expect(parsed.proposal.budgetAllocations[0].rationale).toBe(
      parsed.lines[0].rationale,
    );
    expect(parsed.lines[0].amountMinor).toBe(saved.lines[0].amountMinor);
    expect(parsed.lines[1].amountMinor).toBe(saved.lines[1].amountMinor);
    expect(
      planResultSchema.safeParse({ ...saved, currency: "XYZ" }).success,
    ).toBe(false);
  });

  it("keeps accumulated checked tasks and vendor notes across fresh planning rounds", () => {
    const checked = Array.from(
      { length: 450 },
      (_, index) => `Completed task from earlier round ${index}`,
    );
    const vendorNotes = Object.fromEntries(
      Array.from({ length: 110 }, (_, index) => [
        `Vendor category from round ${index}`,
        `Host notes ${index}`,
      ]),
    );
    const workspace = renderHook(() => useWorkspace("wedding"));
    act(() =>
      workspace.result.current.update((state) => ({
        ...state,
        brief: { ...state.brief, eventName: "Keep accumulated work" },
        checked,
        vendorNotes,
      })),
    );
    workspace.unmount();
    const restored = renderHook(() => useWorkspace("wedding"));
    expect(restored.result.current.state.brief.eventName).toBe(
      "Keep accumulated work",
    );
    expect(restored.result.current.state.checked).toEqual(checked);
    expect(restored.result.current.state.vendorNotes).toEqual(vendorNotes);
    act(() =>
      restored.result.current.update((state) => ({
        ...state,
        brief: { ...state.brief, location: "Chandigarh" },
      })),
    );
    expect(restored.result.current.state.checked).toEqual(checked);
    expect(restored.result.current.state.vendorNotes).toEqual(vendorNotes);
  });

  it("rejects over-range totals and unbounded line metadata", () => {
    const result = allocation();
    expect(
      planResultSchema.safeParse({ ...result, totalMinor: 1_000_000_000_001 })
        .success,
    ).toBe(false);
    const oversized = structuredClone(result);
    oversized.lines[0].rationale = "x".repeat(181);
    expect(planResultSchema.safeParse(oversized).success).toBe(false);
  });

  it("recovers a damaged generated result while retaining the host's draft, notes and checklist", () => {
    const workspace = renderHook(() => useWorkspace("wedding"));
    act(() =>
      workspace.result.current.update((state) => ({
        ...state,
        brief: { ...state.brief, eventName: "Keep this wedding" },
        customTasks: ["Book accessible transport"],
        checked: ["Book accessible transport"],
        vendorNotes: { Venue: "Step-free entrance confirmed" },
        result: allocation(),
        resultSource: "ai",
        revisionRequests: ["Keep the entrance step-free."],
      })),
    );
    workspace.unmount();
    const saved = JSON.parse(
      window.localStorage.getItem("mehfiloom:v2:wedding")!,
    );
    saved.result.lines[0].amountMinor += 1;
    window.localStorage.setItem("mehfiloom:v2:wedding", JSON.stringify(saved));
    const restored = renderHook(() => useWorkspace("wedding"));
    expect(restored.result.current.state).toMatchObject({
      brief: { eventName: "Keep this wedding" },
      customTasks: saved.customTasks,
      checked: saved.checked,
      vendorNotes: saved.vendorNotes,
      revisionRequests: saved.revisionRequests,
      result: null,
      resultSource: null,
    });
    act(() =>
      restored.result.current.update((state) => ({
        ...state,
        brief: { ...state.brief, location: "Chandigarh" },
      })),
    );
    expect(restored.result.current.state.brief.eventName).toBe(
      "Keep this wedding",
    );
  });

  it("rejects an over-capacity local edit without replacing the current draft and clears the warning after a valid edit", () => {
    const vendorNotes = Object.fromEntries(
      Array.from({ length: 230 }, (_, index) => [
        `Vendor ${index}`,
        "n".repeat(1000),
      ]),
    );
    const workspace = renderHook(() => useWorkspace("wedding"));
    act(() => {
      expect(
        workspace.result.current.update((state) => ({
          ...state,
          brief: { ...state.brief, eventName: "Keep the current draft" },
          vendorNotes,
        })),
      ).toBe(true);
    });
    const currentRaw = window.localStorage.getItem("mehfiloom:v2:wedding");
    act(() => {
      expect(
        workspace.result.current.update((state) => ({
          ...state,
          brief: {
            ...state.brief,
            eventName: "This oversized edit must be rejected",
          },
          vendorNotes: {
            ...state.vendorNotes,
            ...Object.fromEntries(
              Array.from({ length: 40 }, (_, index) => [
                `Additional vendor ${index}`,
                "n".repeat(1000),
              ]),
            ),
          },
        })),
      ).toBe(false);
    });
    expect(workspace.result.current.storageStatus).toBe("capacity");
    expect(workspace.result.current.state.brief.eventName).toBe(
      "Keep the current draft",
    );
    expect(workspace.result.current.state.vendorNotes).toEqual(vendorNotes);
    expect(window.localStorage.getItem("mehfiloom:v2:wedding")).toBe(
      currentRaw,
    );
    workspace.unmount();
    const restored = renderHook(() => useWorkspace("wedding"));
    expect(restored.result.current.state.vendorNotes).toEqual(vendorNotes);
    expect(restored.result.current.storageStatus).toBe("capacity");
    act(() => {
      expect(
        restored.result.current.update((state) => ({
          ...state,
          brief: { ...state.brief, location: "Chandigarh" },
        })),
      ).toBe(true);
    });
    expect(restored.result.current.storageStatus).toBe("persistent");
    expect(restored.result.current.state.brief.eventName).toBe(
      "Keep the current draft",
    );
    expect(restored.result.current.state.brief.location).toBe("Chandigarh");
  });

  it("recovers safely from oversized browser data before parsing it", () => {
    window.localStorage.setItem("mehfiloom:v2:wedding", " ".repeat(250001));
    const parse = vi.spyOn(JSON, "parse");
    const { result } = renderHook(() => useWorkspace("wedding"));
    expect(result.current.state.brief.eventName).toBe("");
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
  });
});

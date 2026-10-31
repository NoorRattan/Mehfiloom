import {
  buildPlanResult,
  getEventTemplateProposal,
} from "../backend/lib/planner";
import { newBrief } from "../frontend/lib/events";
import {
  test,
  expect,
  assertAccessible,
  assertNoHorizontalOverflow,
} from "./test";

for (const kind of ["wedding", "birthday", "community"] as const) {
  test(`${kind} generated content reflows at 320 CSS pixels`, async ({
    page,
  }) => {
    const proposal = getEventTemplateProposal(kind);
    const result = buildPlanResult(
      {
        ...proposal,
        conceptTitle: "G".repeat(80),
        timeline: proposal.timeline.map((task, index) =>
          index === 0 ? { ...task, task: "T".repeat(120) } : task,
        ),
        vendorChecklist: proposal.vendorChecklist.map((group, index) =>
          index === 0 ? { ...group, category: "V".repeat(60) } : group,
        ),
      },
      "INR",
      10_000_000,
    );
    const workspace = {
      brief: {
        ...newBrief(kind),
        eventName: "Our accessible celebration",
        location: "Chandigarh",
        budgetAmount: "100000",
      },
      checked: [],
      customTasks: [],
      vendorNotes: {},
      result,
      resultSource: "ai",
      revisionRequests: [],
    };
    await page.addInitScript(
      ({ kind, workspace }) => {
        window.localStorage.setItem(
          `mehfiloom:v2:${kind}`,
          JSON.stringify(workspace),
        );
      },
      { kind, workspace },
    );
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/${kind}/assist`);
    await expect(
      page.getByRole("region", { name: "Your tailored plan" }),
    ).toBeVisible();
    for (const details of await page.locator("details").all()) {
      await details.locator("summary").click();
    }
    await assertAccessible(page);
    await assertNoHorizontalOverflow(page);
    await expect(
      page.getByRole("table", { name: "Budget allocations" }),
    ).toBeVisible();
  });
}

test("cancelled generation preserves editable brief and request text", async ({
  page,
}) => {
  await page.goto("/wedding/assist");
  await page
    .getByRole("textbox", { name: "Celebration name", exact: true })
    .fill("Our quiet garden wedding");
  await page
    .getByRole("textbox", { name: "City or location" })
    .fill("Chandigarh");
  const prompt = page.getByRole("textbox", {
    name: "Describe your celebration or request a change",
  });
  await prompt.fill("Keep vegetarian food and a step-free arrival.");
  // Hold the browser request locally: no provider endpoint is called.
  await page.route("**/api/generate", () => {});
  const requested = page.waitForRequest("**/api/generate");
  await page
    .getByRole("button", { name: "Create your tailored plan", exact: true })
    .click();
  await requested;
  await page.getByRole("button", { name: "Cancel planning" }).click();
  await expect(page.getByRole("status")).toContainText("Planning cancelled");
  await expect(prompt).toHaveValue(
    "Keep vegetarian food and a step-free arrival.",
  );
  await expect(prompt).toBeEnabled();
  await expect(
    page.getByRole("textbox", { name: "Celebration name", exact: true }),
  ).toHaveValue("Our quiet garden wedding");
  await expect(
    page.getByRole("button", {
      name: "Create your tailored plan",
      exact: true,
    }),
  ).toBeEnabled();
});

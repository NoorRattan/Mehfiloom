import { readFile } from "node:fs/promises";
import {
  expect,
  test,
  assertAccessible,
  assertNoHorizontalOverflow,
} from "./test";
import {
  buildPlanResult,
  getEventTemplateProposal,
  type EventType,
} from "../backend/lib/planner";

const kinds = ["wedding", "birthday", "community"] as const;
const routes = [
  "/",
  ...kinds.flatMap((kind) => [
    `/${kind}`,
    `/${kind}/organize`,
    `/${kind}/assist`,
  ]),
];

for (const path of routes) {
  test(`${path} renders accessibly without horizontal overflow`, async ({
    page,
  }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response?.headers()["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await assertAccessible(page);
    await assertNoHorizontalOverflow(page);
  });
}

for (const kind of kinds) {
  test(`${kind} keeps host work through generation, failure, reload and export`, async ({
    page,
  }) => {
    await page.goto(`/${kind}/organize`);
    await page
      .getByRole("textbox", { name: "Celebration name", exact: true })
      .fill(`Our ${kind} gathering`);
    await page
      .getByRole("textbox", { name: "City or location" })
      .fill("Chandigarh");
    await page.getByRole("textbox", { name: "Budget amount" }).fill("100000");
    await page.getByRole("tab", { name: "The checklist" }).click();
    await page
      .getByRole("textbox", { name: "New checklist task" })
      .fill("Confirm the step-free arrival route");
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await page
      .getByRole("checkbox", { name: /Confirm the step-free arrival route/ })
      .check();
    await page.getByRole("tab", { name: "Your vendors" }).click();
    const vendor = page.locator("details").first();
    await vendor.locator("summary").click();
    await vendor
      .getByRole("textbox", { name: "Your notes" })
      .fill("Ask about the quiet seating area");
    await page.getByRole("tab", { name: "Your budget" }).click();
    await page.getByRole("button", { name: /Create a starter budget/ }).click();
    await expect(
      page.getByRole("table", { name: "Budget allocations" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Adjust your allocations" }).click();
    const allocations = page.getByRole("textbox", { name: /allocation$/ });
    const editedFirst = (
      Number(await allocations.nth(0).inputValue()) + 10
    ).toFixed(2);
    const editedSecond = (
      Number(await allocations.nth(1).inputValue()) - 10
    ).toFixed(2);
    await allocations.nth(0).fill(editedFirst);
    await allocations.nth(1).fill(editedSecond);
    await page.getByRole("button", { name: "Save allocation" }).click();
    await page.reload();
    await page.getByRole("tab", { name: "Your budget" }).click();
    await page.getByRole("button", { name: "Adjust your allocations" }).click();
    await expect(allocations.nth(0)).toHaveValue(editedFirst);
    await expect(allocations.nth(1)).toHaveValue(editedSecond);
    await page
      .getByRole("button", { name: "Keep the current allocation" })
      .click();
    await assertAccessible(page);

    await page
      .getByRole("link", { name: "Your AI assistant", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Celebration name", exact: true }),
    ).toHaveValue(`Our ${kind} gathering`);
    const result = buildPlanResult(
      getEventTemplateProposal(kind as EventType),
      "INR",
      10_000_000,
    );
    let fail = false;
    const requests: Array<{
      brief: { eventType: string };
      priorRevisionRequests: string[];
    }> = [];
    await page.route("**/api/generate", async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({
        status: fail ? 503 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          fail
            ? {
                error: {
                  message:
                    "The planning service is busy. Please try again shortly.",
                },
              }
            : { result },
        ),
      });
    });
    const prompt = page.getByRole("textbox", {
      name: "Describe your celebration or request a change",
    });
    await prompt.fill("Keep step-free arrival and a quiet seating area.");
    await page
      .getByRole("button", { name: "Create your tailored plan", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Your tailored plan" }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText(
      "ready in your organizer",
    );
    expect(requests[0].brief.eventType).toBe(kind);
    await assertAccessible(page);
    fail = true;
    await prompt.fill("Simplify decorations while keeping all access needs.");
    await page
      .getByRole("button", { name: "Create your tailored plan", exact: true })
      .click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "planning service is busy",
    );
    await expect(
      page.getByRole("region", { name: "Your tailored plan" }),
    ).toBeVisible();
    expect(requests[1].priorRevisionRequests).toEqual([
      "Keep step-free arrival and a quiet seating area.",
    ]);

    await page.getByRole("link", { name: /Back to your organizer/ }).click();
    await expect(page).toHaveURL(new RegExp(`/${kind}/organize$`));
    await page.reload();
    await page.getByRole("tab", { name: "The checklist" }).click();
    await expect(
      page.getByRole("checkbox", {
        name: /Confirm the step-free arrival route/,
      }),
    ).toBeChecked();
    const downloadReady = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export plan" }).click();
    const download = await downloadReady;
    expect(download.suggestedFilename()).toBe(`mehfiloom-${kind}-plan.txt`);
    const output = await readFile((await download.path())!, "utf8");
    for (const text of [
      `Our ${kind} gathering`,
      "Chandigarh",
      "[x] Confirm the step-free arrival route",
      "Ask about the quiet seating area",
      result.proposal.conceptTitle,
      result.proposal.ideas[0].title,
      result.proposal.openQuestions[0],
    ])
      expect(output).toContain(text);

    const other = kind === "wedding" ? "birthday" : "wedding";
    await page.goto(`/${other}/organize`);
    await expect(
      page.getByRole("textbox", { name: "Celebration name", exact: true }),
    ).toHaveValue("");
  });
}

test("keyboard reaches content and selects organizer sections", async ({
  page,
}) => {
  await page.goto("/wedding/organize");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Edit your details" }),
  ).toBeFocused();
  const overview = page.getByRole("tab", { name: "The overview" });
  await overview.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Your budget" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Your budget" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Your vendors" })).toBeFocused();
  await expect(page.getByRole("tabpanel")).toHaveAccessibleName("Your vendors");
});

test("mobile navigation returns focus after Escape", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "The navigation toggle is a mobile control.",
  );
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Open navigation" });
  await toggle.click();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await assertAccessible(page);
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("API rejects invalid input without a provider and keeps errors private", async ({
  request,
}) => {
  const response = await request.post("/api/generate", {
    data: { privateNote: "never-reflect-this" },
  });
  expect(response.status()).toBe(400);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.text()).not.toContain("never-reflect-this");
});

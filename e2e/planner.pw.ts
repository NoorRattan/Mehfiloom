import { readFile } from "node:fs/promises";
import { expect, test, type Page, type Route } from "@playwright/test";
import {
  buildPlanResult,
  EXAMPLE_PROPOSAL,
  generationRequestSchema,
  parseBudgetMinor,
} from "../lib/planner.ts";

async function stubGeneration(page: Page, requests: unknown[] = []) {
  await page.route("**/api/generate", async (route: Route) => {
    const request = generationRequestSchema.parse(route.request().postDataJSON());
    requests.push(request);
    const brief = request.brief;
    const result = buildPlanResult(
      EXAMPLE_PROPOSAL,
      brief.currency,
      parseBudgetMinor(brief.budgetAmount, brief.currency),
    );
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result }),
    });
  });
}

test("wedding, birthday, and community planners render the core planning sections", async ({ page }) => {
  const routes = [
    { path: "/planner/wedding", title: /Planning a wedding/i },
    { path: "/planner/birthday", title: /Planning a birthday/i },
    { path: "/planner/community", title: /Planning a community event/i },
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.getByRole("link", { name: "Mehfiloom." })).toBeVisible();
    await expect(page.locator(".topbar-center")).toContainText(route.title);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Give every part a place" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Your next steps/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vendor checklist" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ideas that fit" })).toBeVisible();
    const verificationNotice = page.getByRole("complementary", { name: "Treat this as a planning draft" });
    await expect(verificationNotice).toBeVisible();
    await expect(verificationNotice).toContainText("does not verify prices");
  }
});

test("planner reflows at a 200% zoom-equivalent width and 320 CSS pixels, and prints the plan", async ({ page }) => {
  // A 640 CSS pixel viewport represents a 1280 CSS pixel desktop at 200% zoom.
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto("/planner/wedding");
  await expect(page.getByRole("heading", { name: "Give every part a place" })).toBeVisible();
  const zoomEquivalentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(zoomEquivalentWidth).toBeLessThanOrEqual(640);

  await page.setViewportSize({ width: 320, height: 900 });
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(320);

  await page.getByRole("button", { name: "Use example" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Wedding" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Birthday" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Birthday" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Community event" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Event name")).toBeFocused();
  await page.keyboard.type("Keyboard-only birthday");
  await expect(page.getByLabel("Event name")).toHaveValue("Keyboard-only birthday");

  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeHidden();
  await expect(page.locator(".print-plan-document")).toBeVisible();
  await expect(page.locator(".print-document-footer")).toContainText("Verify prices, availability");
  const printBodySize = await page.locator(".print-plan-document").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  const printTableSize = await page.locator(".print-table").first().evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(printBodySize).toBeGreaterThanOrEqual(13.3);
  expect(printTableSize).toBeGreaterThanOrEqual(12);
});

test("edited event brief is saved locally and restored after reload", async ({ page }) => {
  await page.goto("/planner/wedding");
  await page.getByRole("button", { name: "Use example" }).click();
  await page.getByLabel("Event name").fill("Playwright synthetic wedding");
  await page.getByRole("button", { name: "Edit draft" }).click();
  const taskTitle = page.getByRole("textbox", { name: "Task 1 title" });
  const taskTiming = page.getByRole("textbox", { name: "Task 1 suggested timing" });
  await expect(taskTitle).toBeVisible();
  await expect(taskTiming).toBeVisible();
  await taskTitle.fill("Confirm the accessible venue route");
  await taskTiming.fill("Three months ahead");
  await expect(page.getByRole("status").filter({ hasText: "Saved on this device" })).toBeVisible();

  await page.reload();

  await expect(page.getByLabel("Event name")).toHaveValue("Playwright synthetic wedding");
  await expect(page.getByRole("status").filter({ hasText: "Saved on this device" })).toBeVisible();
  await page.getByRole("button", { name: "Edit draft" }).click();
  await expect(page.getByRole("textbox", { name: "Task 1 title" })).toHaveValue("Confirm the accessible venue route");
  await expect(page.getByRole("textbox", { name: "Task 1 suggested timing" })).toHaveValue("Three months ahead");
});

test("revision review preserves local state and sends accepted revision history", async ({ page }) => {
  const requests: unknown[] = [];
  await stubGeneration(page, requests);
  await page.goto("/planner/wedding");
  await page.getByRole("button", { name: "Use example" }).click();
  await page.getByRole("button", { name: "Create my plan" }).click();
  await expect(page.getByText("AI draft · review needed")).toBeVisible();

  const firstRequest = "Keep activities optional and exclude dancing from the celebration.";
  await page.getByLabel("What changed since this draft?").fill(firstRequest);
  await page.getByRole("button", { name: "Review a revision" }).click();
  await expect(page.getByRole("heading", { name: /Revision/ })).toBeVisible();
  await page.getByRole("button", { name: "Accept revision" }).click();
  await expect(page.getByText(/Revision .* accepted/)).toBeVisible();
  const planHeading = page.getByRole("heading", { name: "A plan taking shape" });
  await expect(planHeading).toBeFocused();

  await page.getByLabel("What changed since this draft?").fill("Keep that dancing exclusion and add a quiet seated idea.");
  await page.getByRole("button", { name: "Review a revision" }).click();
  await expect(page.getByRole("heading", { name: /Revision/ })).toBeVisible();

  expect(requests).toHaveLength(3);
  expect(requests[2]).toMatchObject({ priorRevisionRequests: [firstRequest] });
  await page.getByRole("button", { name: "Discard revision" }).click();
  await expect(page.getByText("Revision discarded. Your current plan remains unchanged.")).toBeVisible();
  await expect(planHeading).toBeFocused();

  await page.getByRole("button", { name: "Restore previous state" }).click();
  await expect(page.getByText(/Restored the previous plan state as revision/)).toBeVisible();
  await expect(planHeading).toBeFocused();
});

test("a local edit marks a pending revision stale and prevents applying it", async ({ page }) => {
  await stubGeneration(page);
  await page.goto("/planner/wedding");
  await page.getByRole("button", { name: "Use example" }).click();
  await page.getByRole("button", { name: "Create my plan" }).click();
  await expect(page.getByText("AI draft · review needed")).toBeVisible();

  await page.getByLabel("What changed since this draft?").fill("Add more time for guests to arrive comfortably.");
  await page.getByRole("button", { name: "Review a revision" }).click();
  const revisionReview = page.locator(".revision-review");
  await expect(revisionReview.getByRole("heading", { name: "Revision 1" })).toBeVisible();

  await page.getByRole("button", { name: "Edit draft" }).click();
  await page.getByRole("textbox", { name: "Task 1 title" }).fill("Host edited while revision was pending");
  await expect(revisionReview.getByRole("alert")).toContainText("This plan changed while the revision was being drafted");
  await expect(revisionReview.getByRole("button", { name: "Accept revision" })).toBeDisabled();

  await revisionReview.getByRole("button", { name: "Discard revision" }).click();
  await expect(page.getByRole("heading", { name: "A plan taking shape" })).toBeFocused();
  await expect(page.getByRole("textbox", { name: "Task 1 title" })).toHaveValue("Host edited while revision was pending");
});

test("a recorded forecast above the cap is announced as a budget conflict", async ({ page }) => {
  await page.goto("/planner/birthday");
  await page.getByRole("button", { name: "Edit draft" }).click();
  const costForm = page.locator(".add-cost-form");
  await costForm.getByLabel("Label").fill("Synthetic venue estimate");
  await costForm.getByLabel("Evidence").selectOption("estimate");
  await costForm.getByLabel(/Lower amount \/ rate/).fill("999999");
  await costForm.getByRole("button", { name: "Add cost" }).click();

  await expect(page.getByText("Recorded costs plus reserve exceed the cap")).toBeVisible();
  await expect(page.locator(".costs-section").getByRole("alert")).toContainText("This recorded forecast is above the cap.");
});

test("exported plans can be imported into the isolated test workspace", async ({ page }) => {
  await page.goto("/planner/community");
  await page.getByRole("button", { name: "Use example" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  const exportedPath = await download.path();
  expect(exportedPath).not.toBeNull();
  const exportedJson = await readFile(exportedPath!, "utf8");

  await page.getByRole("button", { name: "Import JSON" }).click();
  await page.getByLabel("Choose a Mehfiloom plan JSON file").setInputFiles({
    name: "synthetic-community-plan.json",
    mimeType: "application/json",
    buffer: Buffer.from(exportedJson),
  });
  await expect(page.getByText("Plan imported and given new local IDs. Review its costs and bookings.")).toBeVisible();
});

test("a mocked provider error leaves the user's event brief available", async ({ page }) => {
  await page.route("**/api/generate", async (route) => {
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "The planning service could not create a draft. Your brief is unchanged; please try again." } }),
    });
  });
  await page.goto("/planner/community");
  await page.getByRole("button", { name: "Use example" }).click();
  await page.getByLabel("Event name").fill("Provider failure keeps this");
  await page.getByRole("button", { name: "Create my plan" }).click();

  await expect(page.locator("#brief-error")).toContainText("Your brief is unchanged");
  await expect(page.getByLabel("Event name")).toHaveValue("Provider failure keeps this");
});

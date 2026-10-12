import { test, expect } from "@playwright/test";
import { gotoApp, resultWpm, typeSnippetLines, waitForStableSnippet, watchConsole } from "./helpers";

test.use({ timezoneId: "America/Los_Angeles" });

function dailyNumber(date: string): number {
    return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse("2024-01-01T00:00:00Z")) / 86_400_000) + 1;
}

test("hydrates a cached build on a different local day and refreshes on return", async ({ page }) => {
    const errors = watchConsole(page);
    await page.clock.setFixedTime(new Date("2027-01-01T07:59:00Z")); // Dec 31 in Los Angeles
    await gotoApp(page);
    await expect(page.getByText(`Daily Challenge #${dailyNumber("2026-12-31")}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Start Daily", exact: true })).toBeEnabled();
    await page.clock.setFixedTime(new Date("2027-01-01T08:01:00Z"));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByText(`Daily Challenge #${dailyNumber("2027-01-01")}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Start Daily", exact: true })).toBeEnabled();
    expect(errors).toEqual([]);
});

test("an in-flight daily keeps its start date in storage and the result share after midnight", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2027-01-01T07:59:00Z"));
    await gotoApp(page);
    await waitForStableSnippet(page);
    const start = page.getByRole("button", { name: "Start Daily", exact: true });
    await expect(start).toBeEnabled();
    await start.click();
    await expect(start).toBeHidden();
    const lines = await waitForStableSnippet(page);
    await page.clock.setFixedTime(new Date("2027-01-01T08:01:00Z"));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await typeSnippetLines(page, lines);
    await expect(resultWpm(page)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(`CodeSprint Daily #${dailyNumber("2026-12-31")}`)).toBeVisible();
    const progress = await page.evaluate(() => JSON.parse(localStorage.getItem("codesprint-daily")!));
    expect(progress.completedDates).toEqual(["2026-12-31"]);
    await page.reload();
    await expect(page.getByText(`Daily Challenge #${dailyNumber("2027-01-01")}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Start Daily", exact: true })).toBeEnabled();
});

import { test, expect, type Page } from "@playwright/test";

import {
    gotoApp,
    resultWpm,
    startButton,
    typeSnippetLines,
    waitForStableSnippet,
} from "./helpers";

/** Mirrors lib/daily.ts: 1-based day index since the 2024-01-01 epoch, local time. */
function expectedDailyNumber(now = new Date()): number {
    const epoch = new Date(2024, 0, 1);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((today.getTime() - epoch.getTime()) / 86_400_000) + 1;
}

/** Start today's daily and return the snippet it loaded into the editor. */
async function startDaily(page: Page): Promise<string[]> {
    await waitForStableSnippet(page);

    // Disabled until the daily pool chunk resolves.
    const start = page.getByRole("button", { name: /^(Start Daily|Practice again)$/ });
    await expect(start).toBeEnabled();
    await start.click();

    // The daily card and the control bar are both idle-only, so the pair going
    // away is the run actually being under way.
    await expect(start).toBeHidden();
    await expect(startButton(page)).toBeHidden();

    return waitForStableSnippet(page);
}

test.describe("Daily challenge", () => {
    test("starts today's challenge, records it, and serves the same snippet on every load", async ({ page }) => {
        const dayNumber = expectedDailyNumber();

        await gotoApp(page);
        await expect(page.getByText(`Daily Challenge #${dayNumber}`)).toBeVisible();

        const firstRun = await startDaily(page);
        expect(firstRun.join("\n").length).toBeGreaterThan(0);

        await typeSnippetLines(page, firstRun);
        await expect(resultWpm(page)).toBeVisible({ timeout: 20000 });

        // The share block renders only when the finished run was the daily, so
        // this is the proof that the daily snippet — not the idle one — was run.
        await expect(page.getByText(`CodeSprint Daily #${dayNumber}`)).toBeVisible();

        await page.reload();
        await expect(page.locator(".monaco-editor").first()).toBeVisible({ timeout: 30000 });
        await expect(page.getByText("Done for today. Same snippet for everyone.")).toBeVisible();

        // Date-seeded: the same day serves the same snippet however often it is opened.
        const secondRun = await startDaily(page);
        expect(secondRun.join("\n")).toBe(firstRun.join("\n"));
    });
});

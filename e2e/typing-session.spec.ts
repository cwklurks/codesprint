import { test, expect } from "@playwright/test";

import {
    gotoApp,
    progressRail,
    readSessionHistory,
    resultWpm,
    settledResultWpm,
    startSession,
    typeSnippetLines,
    waitForStableSnippet,
    watchConsole,
} from "./helpers";

test.describe("Typing session", () => {
    test("completes a full typing session and persists the result", async ({ page }) => {
        const consoleErrors = watchConsole(page);

        await gotoApp(page);
        const lines = await waitForStableSnippet(page);
        expect(lines.join("\n").length).toBeGreaterThan(50);

        await startSession(page);
        await expect(progressRail(page)).toHaveAttribute("aria-valuenow", "0");

        await typeSnippetLines(page, lines);

        // The run ended on its own: the result screen replaced the session panel.
        await expect(resultWpm(page)).toBeVisible({ timeout: 15000 });
        await expect(page.getByText("faster than peers")).toBeVisible();

        const reported = Number(await settledResultWpm(page));
        expect(Number.isFinite(reported)).toBe(true);
        expect(reported).toBeGreaterThan(0);

        // The finish is persisted for the sync readers (analytics, leaderboard).
        await expect.poll(async () => (await readSessionHistory(page)).length).toBe(1);
        const [record] = await readSessionHistory(page);
        expect(record.wpm).toBeGreaterThan(0);
        expect(record.elapsedMs).toBeGreaterThan(0);
        expect(record.totalKeystrokes).toBeGreaterThan(50);
        // Every keystroke was the expected one, so the engine should agree.
        expect(record.accuracy).toBeGreaterThan(0.9);
        expect(Math.round(record.wpm)).toBe(reported);

        expect(consoleErrors).toEqual([]);
    });

    test("loads with a clean console", async ({ page }) => {
        const consoleErrors = watchConsole(page);

        await gotoApp(page);
        await waitForStableSnippet(page);
        await page.waitForLoadState("networkidle");

        expect(consoleErrors).toEqual([]);
    });
});

import { test, expect } from "@playwright/test";

import { completeSession, gotoApp, resultWpm, startButton } from "./helpers";

const NOW_PRACTICING = /Now practicing:/;

test.describe("Result screen", () => {
    test("Tab advances to the next problem", async ({ page }) => {
        await gotoApp(page);
        const firstProblem = ((await page.getByText(NOW_PRACTICING).textContent()) ?? "").trim();
        expect(firstProblem.length).toBeGreaterThan("Now practicing:".length);

        await completeSession(page);

        await page.keyboard.press("Tab");

        await expect(resultWpm(page)).toHaveCount(0);
        await expect(startButton(page)).toBeVisible();
        await expect(page.getByText(NOW_PRACTICING)).not.toHaveText(firstProblem);
    });

    test("shows the final WPM immediately under reduced motion", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });

        await gotoApp(page);
        await completeSession(page);

        const wpm = resultWpm(page);
        const immediate = Number(((await wpm.textContent()) ?? "").trim());
        expect(immediate).toBeGreaterThan(0);

        // No count-up to sit through: the first painted value is the final one.
        await page.waitForTimeout(900);
        const settled = Number(((await wpm.textContent()) ?? "").trim());
        expect(settled).toBe(immediate);
    });
});

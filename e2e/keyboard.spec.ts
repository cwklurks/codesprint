import { test, expect } from "@playwright/test";

import {
    completeSession,
    gotoApp,
    isRunActive,
    resultWpm,
    settledResultWpm,
    waitForStableSnippet,
} from "./helpers";

test.describe("Keyboard and overlays", () => {
    test("Shift+A on the result screen opens the AI drill dialog; in idle it types", async ({ page }) => {
        await gotoApp(page);
        await waitForStableSnippet(page);

        // In idle, Shift+A is the first keystroke of a run (snippets start with
        // capital letters), never a shortcut.
        await page.keyboard.press("Shift+A");
        expect(await isRunActive(page)).toBe(true);
        await expect(page.getByRole("dialog", { name: /AI drill/i })).toHaveCount(0);

        await page.keyboard.press("Escape");
        await completeSession(page);
        const finalWpm = await settledResultWpm(page);

        await page.keyboard.press("Shift+A");
        const dialog = page.getByRole("dialog", { name: /AI drill/i });
        await expect(dialog).toBeVisible();

        // With no API key the only focusable control is "Close (Esc)", so
        // Chakra's initial focus lands there and Enter activates it natively:
        // the dialog dismisses without starting a run or advancing the session
        // behind it. Run state is read off the body class the engine owns
        // because role queries cannot see the session while a modal marks it
        // aria-hidden.
        await page.keyboard.press("Enter");
        expect(await isRunActive(page)).toBe(false);
        await expect(dialog).toHaveCount(0);
        await expect(resultWpm(page)).toHaveText(finalWpm);
    });

    test("Escape closes an open overlay instead of acting on the session", async ({ page }) => {
        await gotoApp(page);
        await completeSession(page);

        const wpm = resultWpm(page);
        const finalWpm = await settledResultWpm(page);

        await page.getByRole("button", { name: "Preferences" }).click();
        const drawer = page.getByRole("dialog");
        await expect(drawer).toBeVisible();

        await page.keyboard.press("Escape");

        await expect(drawer).toHaveCount(0);
        // On the result screen Escape otherwise advances to the next problem —
        // with an overlay open it must only close the overlay.
        await expect(wpm).toBeVisible();
        await expect(wpm).toHaveText(finalWpm);
    });

    test("the skip link is the first tab stop on a fresh load", async ({ page }) => {
        await gotoApp(page);
        await waitForStableSnippet(page);

        await page.keyboard.press("Tab");

        await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    });
});

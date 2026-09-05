import { test, expect } from "@playwright/test";
import {
    gotoApp,
    resultWpm,
    startSession,
    typeSnippetLines,
    waitForStableSnippet,
    watchConsole,
} from "./helpers";

for (const language of ["Python", "JavaScript", "Java", "C++"]) {
    test(`${language} keeps syntax colors and correctable typing decorations`, async ({ page }) => {
        const errors = watchConsole(page);
        await gotoApp(page);
        await page.getByRole("button", { name: language, exact: true }).click();
        const lines = await waitForStableSnippet(page);

        // Tokenization must survive the reduced Monaco contribution list.
        await expect.poll(() => page.locator(".view-line span").evaluateAll((spans) =>
            new Set(spans.map((span) => getComputedStyle(span).color)).size,
        )).toBeGreaterThan(1);

        await startSession(page);
        const first = lines[0].trimStart()[0];
        await page.keyboard.type(first === "~" ? "!" : "~");
        await expect(page.locator(".cs-wrong").first()).toBeVisible();
        await page.keyboard.press("Backspace");
        await expect(page.locator(".cs-wrong")).toHaveCount(0);
        await page.keyboard.type(first);
        await expect(page.locator(".cs-complete").first()).toBeVisible();
        await page.keyboard.press("Backspace");
        await expect(page.locator(".cs-complete")).toHaveCount(0);

        await typeSnippetLines(page, lines);
        await expect(resultWpm(page)).toBeVisible({ timeout: 15000 });
        expect(errors).toEqual([]);
    });
}

test("Vim attaches before typing and survives a snippet change", async ({ page }) => {
    const errors = watchConsole(page);
    await page.addInitScript(() => {
        localStorage.setItem("codesprint-vim-mode-default-v1", "1");
        localStorage.setItem("codesprint-preferences", JSON.stringify({ vimMode: true }));
    });
    await gotoApp(page);
    for (const language of ["Python", "Java"]) {
        await page.getByRole("button", { name: language, exact: true }).click();
        await waitForStableSnippet(page);
        const status = page.locator(".vim-status-bar");
        await expect(status).toBeVisible();
        await expect(status).toContainText("NORMAL");
    }
    await startSession(page);
    // The model is read-only. Visual mode exercises Vim's key handler
    // without asking it to edit the snippet.
    await page.keyboard.press("v");
    await expect(page.locator(".vim-status-bar")).toContainText("VISUAL");
    expect(errors).toEqual([]);
});

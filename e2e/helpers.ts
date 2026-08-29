import { expect, type ConsoleMessage, type Page } from "@playwright/test";

/** localStorage mirror written by lib/storage/session-history.ts on every finish. */
export const SESSION_HISTORY_KEY = "codesprint-session-history";

export type PersistedSession = {
    id: string;
    date: string;
    snippetId: string;
    wpm: number;
    accuracy: number;
    elapsedMs: number;
    totalKeystrokes: number;
    correctKeystrokes: number;
    errorCount: number;
};

/** The idle "Start" button — `exact` keeps it clear of "Start Daily". */
export function startButton(page: Page) {
    return page.getByRole("button", { name: "Start", exact: true });
}

export function progressRail(page: Page) {
    return page.getByRole("progressbar", { name: "Snippet progress" });
}

export function resultWpm(page: Page) {
    return page.getByTestId("result-wpm");
}

export async function gotoApp(page: Page): Promise<void> {
    await page.goto("/");
    await expect(page.locator(".monaco-editor").first()).toBeVisible({ timeout: 30000 });
}

/**
 * The snippet the user is about to type, read straight out of Monaco.
 *
 * Monaco recycles its line nodes, so DOM order is not visual order — the nodes
 * have to be sorted by their `top` offset. It also emits U+00A0 for runs of
 * spaces, which is normalised back to plain spaces here so the text matches the
 * model exactly.
 */
export async function readSnippetLines(page: Page): Promise<string[]> {
    return page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>(".view-line"))
            .map((el) => ({
                top: Number.parseFloat(el.style.top || "0"),
                text: (el.textContent ?? "").replace(/\u00a0/g, " "),
            }))
            .sort((a, b) => a.top - b.top)
            .map((line) => line.text),
    );
}

/**
 * The active snippet changes once per load: the app renders a curated snippet,
 * then swaps in one from the language bundle when that chunk resolves. Typing
 * against the pre-swap text would be typing against a snippet that is about to
 * be replaced, so wait until two consecutive reads agree.
 */
export async function waitForStableSnippet(page: Page): Promise<string[]> {
    let previous: string | null = null;
    await expect
        .poll(
            async () => {
                const current = (await readSnippetLines(page)).join("\n");
                const stable = current.length > 0 && current === previous;
                previous = current;
                return stable;
            },
            { timeout: 30000, intervals: [250, 250, 250, 500] },
        )
        .toBe(true);
    return readSnippetLines(page);
}

/** Click Start and wait for the run: the control bar is only mounted while idle. */
export async function startSession(page: Page): Promise<void> {
    const start = startButton(page);
    await expect(start).toBeEnabled();
    await start.click();
    await expect(start).toBeHidden();
}

/**
 * Type a whole snippet through real key events (the engine listens on a
 * document keydown capture listener).
 *
 * Leading indentation is deliberately not typed: with the default
 * `requireTabForIndent: false`, the engine auto-advances the cursor past
 * start-of-line whitespace, so typing it would desynchronise the cursor.
 */
export async function typeSnippetLines(page: Page, lines: string[]): Promise<void> {
    for (let i = 0; i < lines.length; i++) {
        const body = lines[i].replace(/^[ \t]+/, "");
        if (body.length > 0) {
            await page.keyboard.type(body, { delay: 0 });
        }
        if (i < lines.length - 1) {
            await page.keyboard.press("Enter");
        }
    }
}

/** Start the current snippet, type all of it, and wait for the result screen. */
export async function completeSession(page: Page): Promise<string[]> {
    const lines = await waitForStableSnippet(page);
    await startSession(page);
    await typeSnippetLines(page, lines);
    await expect(resultWpm(page)).toBeVisible({ timeout: 15000 });
    return lines;
}

/**
 * The WPM hero counts up from 0 over ~620 ms, so any read taken the moment the
 * result screen appears is a mid-animation frame. Wait for it to land.
 */
export async function settledResultWpm(page: Page): Promise<string> {
    const wpm = resultWpm(page);
    await expect(wpm).toBeVisible({ timeout: 15000 });

    let previous = "";
    let settled = "";
    await expect
        .poll(
            async () => {
                const current = ((await wpm.textContent()) ?? "").trim();
                const stable = current.length > 0 && current === previous;
                previous = current;
                if (stable) settled = current;
                return stable;
            },
            { timeout: 10000, intervals: [150, 150, 200] },
        )
        .toBe(true);

    return settled;
}

/** True only while a run is under way (see useFocusActiveClass). */
export async function isRunActive(page: Page): Promise<boolean> {
    return page.evaluate(() => document.body.classList.contains("cs-focus-active"));
}

export async function readSessionHistory(page: Page): Promise<PersistedSession[]> {
    return page.evaluate((key) => {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as PersistedSession[]) : [];
    }, SESSION_HISTORY_KEY);
}

/**
 * Collect every console error and uncaught page error. Nothing is filtered —
 * hydration mismatches included, since those are exactly what this catches.
 */
export function watchConsole(page: Page): string[] {
    const errors: string[] = [];
    page.on("console", (message: ConsoleMessage) => {
        if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
    });
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    return errors;
}

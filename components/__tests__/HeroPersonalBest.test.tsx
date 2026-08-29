import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderWithProviders as render } from "@/test-utils/render";
import { Hero } from "../Hero";

// No IndexedDB in jsdom: the localStorage mirror is the whole store here, which
// is also the path a private-mode browser takes.
vi.mock("@/lib/storage/idb-store", async () => {
    const actual = await vi.importActual<typeof import("@/lib/storage/idb-store")>("@/lib/storage/idb-store");
    return { ...actual, isIdbAvailable: vi.fn(async () => false) };
});

describe("Hero personal best", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it("reads the stored best on mount", async () => {
        const { createSession } = await import("@/lib/storage/session-history");
        createSession(sessionInput(91));

        const { container } = render(<Hero />);
        await waitFor(() => expect(container.textContent).toContain("best 91 wpm"));
    });

    it("refreshes when a run is saved while it is mounted", async () => {
        const { createSession } = await import("@/lib/storage/session-history");

        const { container } = render(<Hero />);
        await waitFor(() => expect(container.textContent).toContain("no runs yet"));

        // Reading storage once on mount left the strip claiming "no runs yet"
        // for the rest of the page's life, right after a finished run.
        createSession(sessionInput(77));

        await waitFor(() => expect(container.textContent).toContain("best 77 wpm"));
    });
});

function sessionInput(wpm: number) {
    return {
        snippetId: "algo-js-binary-search",
        language: "javascript" as const,
        lengthCategory: "medium" as const,
        difficulty: "medium" as const,
        wpm,
        rawWpm: wpm + 5,
        accuracy: 0.97,
        elapsedMs: 12000,
        totalKeystrokes: 200,
        correctKeystrokes: 194,
        errorCount: 0,
        history: [],
    };
}

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { LazyMotion, domAnimation } from "framer-motion";

import { AIDrillPanel } from "../AIDrillPanel";

const acceptDrill = vi.fn();
const generateDrill = vi.fn();

const drillState = {
    current: { status: "preview" } as { status: string; error?: string },
    canGenerate: true,
};

vi.mock("@/hooks/useAIDrills", () => ({
    useAIDrills: () => ({
        state:
            drillState.current.status === "preview"
                ? {
                      status: "preview",
                      drill: {
                          title: "Two pointers",
                          content: "def f():\n    return 1\n",
                          explanation: "why",
                          focusAreas: ["keyword"],
                          reasoning: "because",
                          estimatedDifficulty: "easy",
                      },
                      costUsd: 0.001,
                      provider: "claude",
                  }
                : drillState.current,
        generateDrill,
        acceptDrill,
        rejectDrill: vi.fn(),
        reset: vi.fn(),
        canGenerate: drillState.canGenerate,
        remainingToday: 4,
    }),
}));

vi.mock("@/lib/preferences", () => ({
    usePreferences: () => ({
        preferences: {
            aiDrillsEnabled: true,
            aiMaxDrillsPerDay: 10,
            aiDrillLengthPreference: "auto",
        },
    }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
    return (
        <ChakraProvider value={defaultSystem}>
            <LazyMotion features={domAnimation} strict>
                {children}
            </LazyMotion>
        </ChakraProvider>
    );
}

/** jsdom does not evaluate media queries, so drive `matches` explicitly. */
function stubViewport(narrow: boolean) {
    window.matchMedia = ((query: string) => ({
        matches: narrow,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
}

const originalMatchMedia = window.matchMedia;

function press(key: string, init: Partial<KeyboardEventInit> = {}) {
    act(() => {
        window.dispatchEvent(
            new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }),
        );
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    drillState.current = { status: "preview" };
    drillState.canGenerate = true;
    acceptDrill.mockResolvedValue({ id: "ai-drill-1", content: "x" });
    stubViewport(false);
});

afterEach(() => {
    window.matchMedia = originalMatchMedia;
});

describe("AIDrillPanel — unsupported viewport", () => {
    it("closes itself below the breakpoint instead of rendering nothing while held open", async () => {
        const onClose = vi.fn();
        stubViewport(true);

        const { container } = render(
            <AIDrillPanel isOpen onClose={onClose} onAccept={vi.fn()} language="python" />,
            { wrapper: Wrapper },
        );

        // Nothing is rendered, so the parent must be told to drop the overlay —
        // otherwise the session's keyboard gate stays latched and the app deadlocks.
        expect(container.textContent).toBe("");
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("does not spend a generation on a panel it cannot show", () => {
        stubViewport(true);

        render(<AIDrillPanel isOpen onClose={vi.fn()} onAccept={vi.fn()} language="python" />, {
            wrapper: Wrapper,
        });

        expect(generateDrill).not.toHaveBeenCalled();
    });
});

describe("AIDrillPanel — Enter handling", () => {
    it("accepts the drill when no control has focus", async () => {
        const onAccept = vi.fn();
        const onClose = vi.fn();
        render(
            <AIDrillPanel isOpen onClose={onClose} onAccept={onAccept} language="python" />,
            { wrapper: Wrapper },
        );

        (document.activeElement as HTMLElement | null)?.blur();
        press("Enter");

        await waitFor(() => expect(acceptDrill).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("leaves Enter to a focused button so Cancel is not turned into accept", async () => {
        const { findByText } = render(
            <AIDrillPanel isOpen onClose={vi.fn()} onAccept={vi.fn()} language="python" />,
            { wrapper: Wrapper },
        );

        const cancel = await findByText("Cancel (Esc)");
        act(() => (cancel.closest("button") as HTMLButtonElement).focus());

        press("Enter");

        expect(acceptDrill).not.toHaveBeenCalled();
    });

    it("still regenerates on Shift+Enter with a button focused", async () => {
        const { findByText } = render(
            <AIDrillPanel isOpen onClose={vi.fn()} onAccept={vi.fn()} language="python" />,
            { wrapper: Wrapper },
        );

        const cancel = await findByText("Cancel (Esc)");
        act(() => (cancel.closest("button") as HTMLButtonElement).focus());

        press("Enter", { shiftKey: true });

        expect(generateDrill).toHaveBeenCalled();
    });
});

describe("AIDrillPanel — not configured", () => {
    beforeEach(() => {
        drillState.current = {
            status: "error",
            error: "AI drills not enabled or no API key configured",
        };
        drillState.canGenerate = false;
    });

    it("points at Preferences instead of offering retries that cannot work", async () => {
        const { findByText, queryByText } = render(
            <AIDrillPanel isOpen onClose={vi.fn()} onAccept={vi.fn()} language="python" />,
            { wrapper: Wrapper },
        );

        await findByText("Add an API key in Preferences to enable AI drills.");
        expect(queryByText("Try again")).toBeNull();
        expect(queryByText("Generate another (Shift+Enter)")).toBeNull();
        expect(queryByText("Use this drill (Enter)")).toBeNull();
        await findByText("Close (Esc)");
    });

    it("hides the remaining-count badge for an unavailable feature", async () => {
        const { findByText, queryByText } = render(
            <AIDrillPanel isOpen onClose={vi.fn()} onAccept={vi.fn()} language="python" />,
            { wrapper: Wrapper },
        );

        await findByText("Close (Esc)");
        expect(queryByText("4 remaining today")).toBeNull();
    });

    it("keeps the full button row for a transient error", async () => {
        drillState.current = { status: "error", error: "Generation failed" };
        drillState.canGenerate = true;

        const { findByText } = render(
            <AIDrillPanel isOpen onClose={vi.fn()} onAccept={vi.fn()} language="python" />,
            { wrapper: Wrapper },
        );

        await findByText("Try again");
        await findByText("Generate another (Shift+Enter)");
        await findByText("4 remaining today");
    });
});

describe("AIDrillPanel — accept failures", () => {
    it("closes the dialog even when the session hand-off rejects", async () => {
        const onClose = vi.fn();
        const onAccept = vi.fn().mockRejectedValue(new Error("snippet refresh failed"));
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

        render(
            <AIDrillPanel isOpen onClose={onClose} onAccept={onAccept} language="python" />,
            { wrapper: Wrapper },
        );

        (document.activeElement as HTMLElement | null)?.blur();
        press("Enter");

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        consoleError.mockRestore();
    });
});

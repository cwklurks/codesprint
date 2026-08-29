import React from "react";
import { describe, it, expect } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { LazyMotion, domAnimation } from "framer-motion";
import { ResultScreen } from "../session/ResultScreen";

/**
 * The app mounts every animation under `<LazyMotion strict>`, where a full
 * `motion.*` component throws at render time. Rendering the finished-run screen
 * inside the same wrapper is what proves the result choreography only ever uses
 * `m` / `m.create`.
 */
function Wrapper({ children }: { children: React.ReactNode }) {
    return (
        <ChakraProvider value={defaultSystem}>
            <LazyMotion features={domAnimation} strict>
                {children}
            </LazyMotion>
        </ChakraProvider>
    );
}

const baseProps = {
    wpm: 72.4,
    rawWpm: 78,
    accuracy: 0.96,
    timeMs: 15000,
    errors: 2,
    totalKeystrokes: 190,
    correctKeystrokes: 184,
    snippetTitle: "Binary Search",
    snippetId: "algo-js-binary-search",
    language: "javascript" as const,
    difficulty: "medium",
    lengthCategory: "medium" as const,
    errorLog: [],
    history: [
        { time: 1, wpm: 40, raw: 45, errors: 0, burst: 50 },
        { time: 2, wpm: 60, raw: 66, errors: 1, burst: 70 },
        { time: 3, wpm: 72, raw: 78, errors: 0, burst: 80 },
    ],
    autoAdvanceDeadline: null,
    canAdvance: true,
    onNext: () => {},
    prefersReducedMotion: false,
    contentLength: 120,
};

describe("ResultScreen", () => {
    it("renders the finished-run choreography under LazyMotion strict", async () => {
        const { getByTestId } = render(<ResultScreen {...baseProps} />, { wrapper: Wrapper });
        await waitFor(() => expect(getByTestId("result-wpm").textContent).toBe("72"));
    });

    it("renders the daily streak, XP and unlocked achievements below the card", () => {
        const { container } = render(
            <ResultScreen
                {...baseProps}
                xpGained={120}
                daily={{ dateStr: "2026-01-02", dayNumber: 7, streak: 3 }}
                newlyUnlocked={[
                    {
                        id: "a1",
                        name: "First Blood",
                        description: "First finished run",
                        category: "milestone",
                        rarity: "common",
                        icon: "*",
                        predicate: () => true,
                    },
                ]}
            />,
            { wrapper: Wrapper },
        );
        expect(container.textContent).toContain("days streak");
        expect(container.textContent).toContain("+120 XP");
        expect(container.textContent).toContain("First Blood");
    });
});

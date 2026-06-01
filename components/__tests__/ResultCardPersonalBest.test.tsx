import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderWithProviders as render } from "@/test-utils/render";
import ResultCard from "../ResultCard";

// ResultGraph draws to <canvas>, which jsdom does not implement; stub it out.
vi.mock("../ResultGraph", () => ({ default: () => null }));

const baseProps = {
    wpm: 80,
    rawWpm: 85,
    accuracy: 0.97,
    timeMs: 12000,
    errors: 0,
    snippetTitle: "Binary Search",
    snippetId: "algo-js-binary-search",
    language: "javascript" as const,
    difficulty: "medium",
    lengthCategory: "medium",
    autoAdvanceDeadline: null,
    history: [],
    contentLength: 100,
    errorLog: [],
};

describe("ResultCard personal best", () => {
    it("shows a NEW BEST badge with the delta over the prior best", () => {
        const { container } = render(
            <ResultCard {...baseProps} wpm={80} priorBestWpm={70} isNewBest />
        );
        expect(container.textContent).toContain("NEW BEST");
        // 80 - 70 = +10
        expect(container.textContent).toContain("+10");
    });

    it("does not show the NEW BEST badge when the run did not beat the prior best", () => {
        const { container } = render(
            <ResultCard {...baseProps} wpm={60} priorBestWpm={70} isNewBest={false} />
        );
        expect(container.textContent).not.toContain("NEW BEST");
        // Falls back to a subtle "best" line referencing the prior best.
        expect(container.textContent?.toLowerCase()).toContain("best");
        expect(container.textContent).toContain("70");
    });

    it("renders nothing PB-related when no prior best info is supplied", () => {
        const { container } = render(<ResultCard {...baseProps} />);
        expect(container.textContent).not.toContain("NEW BEST");
    });
});

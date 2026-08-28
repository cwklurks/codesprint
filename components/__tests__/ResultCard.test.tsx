import React from "react";
import { describe, it, expect, vi } from "vitest";
import { waitFor } from "@testing-library/react";
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
};

describe("ResultCard honesty", () => {
    it("labels uncorrected errors honestly when mistakes were typed then fixed", () => {
        // Two mistakes were made (errorLog) but both corrected (errors = 0).
        const errorLog = [
            { expected: "a", got: "b", index: 1 },
            { expected: ";", got: ":", index: 2 },
        ];
        const { container } = render(<ResultCard {...baseProps} errors={0} errorLog={errorLog} />);

        // The headline char stat must not claim "incorrect" while the
        // Most-Mistaken list below shows fumbled keys.
        expect(container.textContent).toContain("correct/uncorrected");
        expect(container.textContent).not.toContain("correct/incorrect");
        expect(container.textContent).toContain("Most Mistaken (all attempts)");
    });

    it("surfaces Accuracy on the on-screen stat row (matching the share card)", () => {
        const { container } = render(<ResultCard {...baseProps} accuracy={0.97} errorLog={[]} />);
        expect(container.textContent).toContain("Accuracy");
        expect(container.textContent).toContain("97%");
    });

    it("points the keyboard hint at the next problem, not a page", () => {
        const { container } = render(<ResultCard {...baseProps} errorLog={[]} onNext={() => {}} />);
        expect(container.textContent).toContain("next problem");
        expect(container.textContent).not.toContain("next page");
    });
});

describe("ResultCard WPM count-up", () => {
    it("settles on the exact rounded final WPM", async () => {
        const { getByTestId } = render(<ResultCard {...baseProps} wpm={80.4} errorLog={[]} />);
        // The count-up must land on the snapshot value, never a lerp artifact.
        await waitFor(() => expect(getByTestId("result-wpm").textContent).toBe("80"));
    });

    it("never overshoots the target while counting", async () => {
        const { getByTestId } = render(<ResultCard {...baseProps} wpm={132} errorLog={[]} />);
        const node = getByTestId("result-wpm");
        expect(Number(node.textContent)).toBeLessThanOrEqual(132);
        await waitFor(() => expect(node.textContent).toBe("132"));
    });
});
